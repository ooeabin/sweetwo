import { addInquiryMessage, fetchInquiries, qk, stopAccess, type Inquiry } from '@sweetwo/api';
import { formatDot, todayKst } from '@sweetwo/core';
import { Badge, Button, EmptyState, ListRow, PageHeader } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { InquiryText } from './s-19a-inquiry';

const day = (s: string) => formatDot(todayKst(new Date(s)));
const hoursLeft = (until: string | null) =>
  until ? Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 3_600_000)) : 0;
const scopeText = (s: string[]) => s.map((x) => copy.accessScopes[x] ?? x).join(', ');

// S-19a 내 문의: 목록(번호, 분류, 상태, 날짜) → 상세(대화, 덧붙이기). 열람 요청이 오면 상세 위 “문의를 확인하려면
// 동의가 필요해요” → S-19b, 동의한 동안 “상담원이 확인 중이에요 / 월 수입·지출 화면 / 23시간 남았어요” + ‘지금 그만 보게 하기’.
export function S19aInquiries() {
  const nav = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.inquiries, queryFn: fetchInquiries });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (list.isLoading) return <MainFrame current={null} columns={[null]} />;
  const rows = list.data ?? [];
  const q: Inquiry | undefined = id ? rows.find((r) => r.id === id) : undefined;

  const run = async (f: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
      await qc.invalidateQueries({ queryKey: qk.inquiries });
      toast(done);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  const listBody = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.myInquiries}
        backLabel={copy.back}
        backTo={copy.help}
        onBack={() => nav('/settings/help')}
      />
      {rows.length === 0 ? (
        <EmptyState title={copy.noInquiries} />
      ) : (
        <div className="hg-list">
          {rows.map((r) => (
            <ListRow
              key={r.id}
              label={
                <>
                  {copy.inquiryNo(r.no)}{' '}
                  <Badge kind={r.status === 'done' ? 'done' : 'temp'}>
                    {copy.inquiryStatus[r.status]}
                  </Badge>
                </>
              }
              sub={`${copy.categories[r.category]}, ${day(r.created_at)}`}
              onClick={() => nav(`/settings/help/inquiries/${r.id}`)}
            />
          ))}
        </div>
      )}
      <div className="hg-row">
        <Button variant="primary" onClick={() => nav('/settings/help/inquiry')}>
          {copy.contact}
        </Button>
      </div>
    </div>
  );
  if (!q) return <MainFrame current={null} page={{ title: copy.title }} columns={[listBody]} />;

  const asking = q.access_request.find((a) => a.status === 'requested');
  const on = q.access_request.find((a) => a.status === 'approved');
  const closed =
    q.status === 'done' && !!q.done_at && Date.parse(q.done_at) < Date.now() - 7 * 86_400_000;
  const msgs = [...q.inquiry_message].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const detail = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.inquiryNo(q.no)}
        backLabel={copy.back}
        backTo={copy.myInquiries}
        onBack={() => nav('/settings/help/inquiries')}
      />
      {on && (
        <div className="hg-card hg-stack" style={{ gap: 'var(--space-2)' }} role="status">
          <strong>{copy.accessOn}</strong>
          <span>{scopeText(on.scope)}</span>
          <span className="hg-q__help">{copy.accessLeft(hoursLeft(on.expires_at))}</span>
          <div className="hg-row">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => stopAccess(on.id), copy.accessStopped)}
            >
              {copy.accessStop}
            </Button>
          </div>
        </div>
      )}
      {asking && (
        <div className="hg-banner hg-banner--info" role="status">
          <span>{copy.accessAsk}</span>
          <Button size="sm" onClick={() => nav(`/settings/help/access/${asking.id}`)}>
            {copy.accessSee}
          </Button>
        </div>
      )}
      <p className="hg-q__help">
        {copy.categories[q.category]}, {copy.inquiryStatus[q.status]}
      </p>
      <ol
        className="hg-stack"
        style={{ gap: 'var(--space-4)', listStyle: 'none', padding: 0, margin: 0 }}
      >
        {msgs.map((m) => (
          <li key={m.id} className="hg-card hg-stack" style={{ gap: 'var(--space-1)' }}>
            <span className="hg-q__help">
              {m.author === 'user' ? copy.me2 : copy.agent}, {day(m.created_at)}
            </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>
          </li>
        ))}
      </ol>
      {closed ? (
        <p className="hg-q__help">{copy.closedNote}</p>
      ) : (
        <form
          className="hg-stack"
          style={{ gap: 'var(--space-3)' }}
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t) return;
            void run(() => addInquiryMessage(q.id, t), copy.replySent).then(() => setText(''));
          }}
        >
          <InquiryText label={copy.replyLabel} value={text} onChange={setText} />
          <div className="hg-row">
            <Button variant="secondary" type="submit" disabled={!text.trim() || busy}>
              {copy.reply}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[detail]} />;
}
