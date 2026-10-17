import {
  adminAnswerInquiry,
  adminRequestAccess,
  adminSetInquiryStatus,
  fetchAdminInquiry,
  type InquiryStatus,
} from '@sweetwo/api';
import { ACCESS_SCOPES, formatKstDateTime } from '@sweetwo/core';
import { Badge, Button, Chip } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { copy } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';

const STATUSES: InquiryStatus[] = ['received', 'in_progress', 'waiting_user', 'done'];

// AD-06 문의 상세: 대화, 자동 첨부(사용자가 켠 경우만, 금액·메모 없음), 답변(해요체) + 상태, ‘답변 보내기’
// (보내면 ‘사용자 답변 대기’ + 앱 ‘내 문의’ 알림). 화면 확인이 필요하면 AD-04 L2 동의 요청(CS만).
export function AD06Inquiry() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useAdmin();
  const cs = me.roles.includes('cs');
  const q = useQuery({ queryKey: ['admin', 'inquiry', id], queryFn: () => fetchAdminInquiry(id) });
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<InquiryStatus>('waiting_user');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () =>
    Promise.all([
      q.refetch(),
      qc.invalidateQueries({ queryKey: ['admin', 'inquiries'] }),
      qc.invalidateQueries({ queryKey: ['admin', 'inquiry-counts'] }),
    ]);

  if (!q.data)
    return (
      <Frame menu="inquiries" title={copy.menus.inquiries}>
        {null}
      </Frame>
    );
  const d = q.data;
  const send = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminAnswerInquiry(d.id, body.trim(), status);
      setBody('');
      setMsg(copy.answered);
      await refresh();
    } catch {
      setMsg(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame
      menu="inquiries"
      title={`${d.no} ${copy.categories[d.category] ?? d.category}`}
      actions={<Badge kind="temp">{copy.statuses[d.status] ?? d.status}</Badge>}
    >
      <div className="hg-admin__grid">
        <div className="hg-admin__col">
          <ol className="hg-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {d.messages.map((m, i) => (
              <li key={i} className="hg-card hg-stack" style={{ gap: 'var(--space-1)' }}>
                <span className="hg-card__meta">
                  {m.author === 'admin' ? copy.admin : copy.user} {formatKstDateTime(m.created_at)}
                </span>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.body}</p>
              </li>
            ))}
          </ol>
          {cs && (
            <section className="hg-card hg-stack" aria-label={copy.answer}>
              <label className="hg-field">
                <span className="hg-field__label">{copy.answer}</span>
                <textarea
                  className="hg-input"
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={4000}
                />
              </label>
              <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
                <select
                  className="hg-input"
                  aria-label={copy.statusLabel}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InquiryStatus)}
                  style={{ width: 'auto' }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {copy.statuses[s]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  aria-busy={busy}
                  disabled={!body.trim()}
                  onClick={() => void send()}
                >
                  {copy.sendAnswer}
                </Button>
                {d.status === 'received' && (
                  <Button
                    variant="secondary"
                    onClick={() => void adminSetInquiryStatus(d.id, 'in_progress').then(refresh)}
                  >
                    {copy.statuses.in_progress}
                  </Button>
                )}
              </div>
              {msg && (
                <p className="hg-help" role="status">
                  {msg}
                </p>
              )}
            </section>
          )}
        </div>
        <div className="hg-admin__col">
          <section className="hg-card hg-stack" aria-label={copy.attach}>
            <span className="hg-card__label">{copy.attach}</span>
            {d.user_id && (
              <Button variant="link" size="sm" onClick={() => nav(`/members/${d.user_id}`)}>
                {d.user_id}
              </Button>
            )}
            {d.attach ? (
              Object.entries(d.attach).map(([k, v]) => (
                <div key={k} className="hg-row" style={{ justifyContent: 'space-between' }}>
                  <span className="hg-card__meta">{k}</span>
                  <span>
                    {typeof v === 'string' || typeof v === 'number' ? v : JSON.stringify(v)}
                  </span>
                </div>
              ))
            ) : (
              <span className="hg-help">—</span>
            )}
          </section>
          {d.access.map((a) => (
            <section key={a.id} className="hg-card hg-stack" aria-label={copy.l2}>
              <span className="hg-card__label">
                {copy.l2} {copy.accessStatus[a.status] ?? a.status}
              </span>
              <span>{a.scope.map((s) => copy.l2Scopes[s] ?? s).join(', ')}</span>
              {a.expires_at && <span className="hg-help">{formatKstDateTime(a.expires_at)}</span>}
            </section>
          ))}
          {cs && d.user_id && d.status !== 'done' && (
            <AccessForm inquiryId={d.id} onDone={() => void refresh()} />
          )}
        </div>
      </div>
    </Frame>
  );
}

function AccessForm({ inquiryId, onDone }: { inquiryId: string; onDone: () => void }) {
  const [scopes, setScopes] = useState<string[]>([]);
  const [raw, setRaw] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (s: string) =>
    setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await adminRequestAccess(inquiryId, scopes, raw, reason);
      setMsg(copy.requested);
      setScopes([]);
      onDone();
    } catch {
      setMsg(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="hg-card hg-stack" aria-label={copy.askConsent}>
      <span className="hg-card__label">{copy.askConsent}</span>
      <div className="hg-row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {ACCESS_SCOPES.map((s) => (
          <Chip key={s} small selected={scopes.includes(s)} onClick={() => toggle(s)}>
            {copy.l2Scopes[s]}
          </Chip>
        ))}
      </div>
      <label className="hg-row" style={{ gap: 'var(--space-2)' }}>
        <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} />
        {copy.raw}
      </label>
      <label className="hg-field">
        <span className="hg-field__label">{copy.l1Reason}</span>
        <input className="hg-input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {msg && (
        <p className="hg-help" role="status">
          {msg}
        </p>
      )}
      <Button
        variant="primary"
        aria-busy={busy}
        disabled={!scopes.length || !reason.trim() || (raw && scopes.length !== 1)}
        onClick={() => void go()}
      >
        {copy.sendRequest}
      </Button>
    </section>
  );
}
