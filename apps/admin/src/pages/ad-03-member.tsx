import {
  AdminError,
  adminAccountAction,
  adminReveal,
  fetchAdminAccessData,
  fetchAdminUser,
  type AdminAction,
} from '@sweetwo/api';
import {
  daysBetween,
  formatKstDateTime,
  formatWon,
  hoursBetween,
  todayKst,
  type AdminAccessData,
  type AdminReveal,
} from '@sweetwo/core';
import { Button, Chip, DataTable, Modal } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { copy } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';

type L1Scope = 'email' | 'sign_ins' | 'payments';
const REVEAL_MS = 30 * 60_000;

// AD-03 회원·부부 상세(L0: 구조 정보만, 금액·항목명·메모 없음). 글자 선택·복사 막음(hg-admin__main).
// ‘개인정보 보기’ = AD-04 L1(사유 + 문의 번호 → 30분 표시 후 다시 가림), ‘계정 조치’ = AD-05.
// L2 동의 요청은 문의(AD-06)에서. 동의가 있으면 위 띠 + ‘보기’(동의 범위만, 읽기 전용). 운영 역할은 버튼 없음.
export function AD03Member() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const me = useAdmin();
  const cs = me.roles.includes('cs') || me.roles.includes('super');
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => fetchAdminUser(id) });
  const [panel, setPanel] = useState<'reveal' | 'action' | null>(null);
  const [shown, setShown] = useState<{ data: AdminReveal; until: number } | null>(null);
  const [access, setAccess] = useState<AdminAccessData | null>(null);

  // 30분 뒤 다시 가림
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(null), Math.max(0, shown.until - Date.now()));
    return () => window.clearTimeout(t);
  }, [shown]);

  if (q.isLoading)
    return (
      <Frame menu="members" title={copy.memberTitle}>
        {null}
      </Frame>
    );
  if (q.isError || !q.data)
    return (
      <Frame menu="members" title={copy.memberTitle}>
        <p className="hg-help">{copy.noMember}</p>
      </Frame>
    );
  const u = q.data;
  const approved = u.access.find((a) => a.status === 'approved' && a.expires_at);
  const left = u.deletion_requested_at
    ? 30 - daysBetween(u.deletion_requested_at.slice(0, 10), todayKst())
    : null;

  return (
    <Frame
      menu="members"
      title={copy.memberTitle}
      actions={
        cs && (
          <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" onClick={() => setPanel('reveal')}>
              {copy.reveal}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPanel('action')}>
              {copy.action}
            </Button>
          </div>
        )
      }
    >
      {left !== null && (
        <div className="hg-body__banner" role="status">
          {copy.deleting(Math.max(0, left))}
        </div>
      )}
      {approved && approved.expires_at && (
        <div className="hg-body__banner" role="status">
          <span>{approved.scope.map((s) => copy.l2Scopes[s] ?? s).join(', ')}</span>{' '}
          <small>
            {copy.hoursLeft(hoursBetween(new Date().toISOString(), new Date(approved.expires_at)))}
          </small>{' '}
          <Button
            variant="link"
            size="sm"
            onClick={() => void fetchAdminAccessData(approved.id).then(setAccess)}
          >
            {copy.see}
          </Button>
        </div>
      )}
      <div className="hg-admin__grid">
        <div className="hg-admin__col">
          <section className="hg-card hg-stack" aria-label={copy.account}>
            <span className="hg-card__label">{copy.account}</span>
            <KV k={copy.cols.userId} v={u.user_id} />
            <KV
              k={copy.cols.email}
              v={shown?.data.email ?? <span className="hg-mask-text">{u.email_masked ?? '—'}</span>}
            />
            <KV k={copy.provider} v={u.provider ?? '—'} />
            <KV k={copy.cols.joined} v={u.created_at ? formatKstDateTime(u.created_at) : '—'} />
            <KV
              k={copy.lastSeen}
              v={u.last_sign_in_at ? formatKstDateTime(u.last_sign_in_at) : '—'}
            />
            <KV k={copy.cols.sub} v={u.subscription} />
            <span className="hg-help">{copy.sessions(u.sessions)}</span>
          </section>
          <section className="hg-card hg-stack" aria-label={copy.space}>
            <span className="hg-card__label">{copy.space}</span>
            <KV k={copy.cols.couple} v={copy.coupleStates[u.couple_state ?? ''] ?? '—'} />
            <KV
              k={copy.partner}
              v={
                u.partner_id ? (
                  <Button variant="link" size="sm" onClick={() => nav(`/members/${u.partner_id}`)}>
                    {u.partner_id}
                  </Button>
                ) : (
                  '—'
                )
              }
            />
            {u.invites.map((i) => (
              <span key={i.created_at} className="hg-help">
                {copy.invite(
                  formatKstDateTime(i.created_at),
                  formatKstDateTime(i.expires_at),
                  i.used_at ? formatKstDateTime(i.used_at) : null,
                )}
              </span>
            ))}
          </section>
          <section className="hg-card hg-stack" aria-label={copy.data}>
            <span className="hg-card__label">{copy.data}</span>
            <span>
              {copy.counts(
                u.counts.assets,
                u.counts.assets_estimated,
                u.counts.goals,
                u.counts.closes,
              )}
            </span>
            <KV k={copy.planStatus} v={u.plan_status ?? '—'} />
          </section>
          <DataTable
            label={copy.consents}
            rows={u.consents}
            rowKey={(c) => `${c.kind}-${c.at}`}
            columns={[
              { key: 'kind', label: copy.consents, render: (c) => c.kind },
              { key: 'version', label: copy.versionCol, render: (c) => c.version },
              {
                key: 'agreed',
                label: copy.agreedCol,
                render: (c) => (c.agreed ? copy.agreed : copy.refused),
              },
              { key: 'at', label: copy.auditCols.at, render: (c) => formatKstDateTime(c.at) },
            ]}
          />
          {shown?.data.sign_ins && (
            <DataTable
              label={copy.l1Scopes.sign_ins}
              rows={shown.data.sign_ins}
              rowKey={(s) => `${s.created_at}-${s.user_agent}`}
              columns={[
                {
                  key: 'at',
                  label: copy.auditCols.at,
                  render: (s) => (s.updated_at ? formatKstDateTime(s.updated_at) : '—'),
                },
                { key: 'ua', label: copy.device, render: (s) => s.user_agent ?? '—' },
              ]}
            />
          )}
          {access && <AccessView d={access} />}
        </div>
        <div className="hg-admin__col">
          {panel === 'reveal' && cs && (
            <RevealForm
              userId={u.user_id}
              onShown={(data) => {
                setShown({ data, until: Date.now() + REVEAL_MS });
                setPanel(null);
              }}
            />
          )}
          {panel === 'action' && cs && (
            <ActionForm userId={u.user_id} onDone={() => void q.refetch()} />
          )}
          {shown && (
            <p className="hg-help" role="status">
              {copy.revealUntil(formatKstDateTime(new Date(shown.until).toISOString()))}
            </p>
          )}
        </div>
      </div>
    </Frame>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="hg-row" style={{ justifyContent: 'space-between', gap: 'var(--space-4)' }}>
      <span className="hg-card__meta">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function RevealForm({ userId, onShown }: { userId: string; onShown: (d: AdminReveal) => void }) {
  const [reason, setReason] = useState(copy.l1Reasons[0] ?? '');
  const [no, setNo] = useState('');
  const [scopes, setScopes] = useState<L1Scope[]>(['email']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (s: L1Scope) =>
    setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      onShown(await adminReveal(userId, reason, no, scopes));
    } catch (e) {
      setErr(
        e instanceof AdminError && e.code === 'reason_required' ? copy.inquiryNo : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="hg-card hg-stack" aria-label={copy.l1}>
      <span className="hg-card__label">{copy.l1}</span>
      <label className="hg-field">
        <span className="hg-field__label">{copy.l1Reason}</span>
        <select className="hg-input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {copy.l1Reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="hg-field">
        <span className="hg-field__label">{copy.inquiryNo}</span>
        <input
          className="hg-input"
          value={no}
          onChange={(e) => setNo(e.target.value)}
          placeholder="A-10001"
        />
      </label>
      <div className="hg-row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {(Object.keys(copy.l1Scopes) as L1Scope[]).map((s) => (
          <Chip key={s} small selected={scopes.includes(s)} onClick={() => toggle(s)}>
            {copy.l1Scopes[s]}
          </Chip>
        ))}
      </div>
      {err && <p className="hg-help is-error">{err}</p>}
      <Button
        variant="primary"
        aria-busy={busy}
        disabled={!/^A-\d+$/i.test(no.trim()) || !scopes.length}
        onClick={() => void go()}
      >
        {copy.revealGo}
      </Button>
    </section>
  );
}

function ActionForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [action, setAction] = useState<AdminAction>('sign_out_all');
  const [no, setNo] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await adminAccountAction(userId, action, no.trim(), note);
      setMsg(copy.done);
      onDone();
    } catch {
      setMsg(copy.failed);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  return (
    <section className="hg-card hg-stack" aria-label={copy.action}>
      <span className="hg-card__label">{copy.action}</span>
      <label className="hg-field">
        <span className="hg-field__label">{copy.action}</span>
        <select
          className="hg-input"
          value={action}
          onChange={(e) => setAction(e.target.value as AdminAction)}
        >
          {Object.entries(copy.actions).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="hg-field">
        <span className="hg-field__label">{copy.inquiryNo}</span>
        <input
          className="hg-input"
          value={no}
          onChange={(e) => setNo(e.target.value)}
          placeholder="A-10001"
        />
      </label>
      <label className="hg-field">
        <span className="hg-field__label">{copy.note}</span>
        <input className="hg-input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {msg && (
        <p className="hg-help" role="status">
          {msg}
        </p>
      )}
      <Button
        variant={action === 'sign_out_all' ? 'danger' : 'primary'}
        aria-busy={busy}
        disabled={!/^A-\d+$/i.test(no.trim())}
        onClick={() => (action === 'sign_out_all' ? setConfirm(true) : void run())}
      >
        {copy.run}
      </Button>
      {confirm && (
        <Modal
          title={copy.confirmSignOut}
          confirmLabel={copy.actions.sign_out_all ?? ''}
          cancelLabel={copy.cancel}
          onConfirm={() => void run()}
          onCancel={() => setConfirm(false)}
          busy={busy}
        />
      )}
    </section>
  );
}

function AccessView({ d }: { d: AdminAccessData }) {
  const val = (v: string | number | null) =>
    v === null ? '—' : typeof v === 'number' ? formatWon(v) : v;
  return (
    <section className="hg-card hg-stack" aria-label={copy.l2View}>
      <span className="hg-card__label">{copy.l2View}</span>
      {d.income_spend && (
        <>
          <KV k={copy.l2Labels.income} v={val(d.income_spend.monthly_income)} />
          <KV k={copy.l2Labels.fixed} v={val(d.income_spend.fixed_total)} />
          <KV k={copy.l2Labels.living} v={val(d.income_spend.living_budget)} />
          <KV k={copy.l2Labels.loan} v={val(d.income_spend.loan_repayment)} />
        </>
      )}
      {d.goals?.map((g) => (
        <KV key={g.name} k={g.name} v={val(g.target)} />
      ))}
      {d.assets?.map((a) => (
        <KV key={`${a.name}-${a.grp}`} k={a.name} v={val(a.amount)} />
      ))}
      {d.plan && <KV k={copy.planStatus} v={`${d.plan.status} ${d.plan.done}/${d.plan.lines}`} />}
      {d.close && <KV k={copy.l2Labels.close} v={`${d.close.status} ${val(d.close.spent)}`} />}
      {d.calendar?.map((c) => (
        <KV key={c.name} k={c.name} v={c.kind} />
      ))}
    </section>
  );
}
