import { answerAccessRequest, fetchInquiries, qk } from '@sweetwo/api';
import { Badge, Button, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { copy } from '../copy';

// S-19b 관리자 열람 동의(docs/spec/25-settings.md): “문의 #A-10234” / “동의하면 24시간만 봐요”,
// 볼 수 있어요(요청 범위 + “금액은 구간으로” 또는 원값이면 “금액이 그대로 보여요”), 보지 않아요(고정 칩),
// ‘동의해요’(24시간, 배우자에게 열람 알림) / ‘거절할게요’ → 내 문의.
export function S19bAccess() {
  const nav = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.inquiries, queryFn: fetchInquiries });
  const [busy, setBusy] = useState(false);
  if (list.isLoading) return <MainFrame current={null} columns={[null]} />;
  const q = (list.data ?? []).find((x) => x.access_request.some((a) => a.id === id));
  const r = q?.access_request.find((a) => a.id === id);
  if (!q || !r || r.status !== 'requested')
    return (
      <Navigate to={q ? `/settings/help/inquiries/${q.id}` : '/settings/help/inquiries'} replace />
    );
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await answerAccessRequest(r.id, accept);
      await qc.invalidateQueries({ queryKey: qk.inquiries });
      if (!accept) toast(copy.accessDeclined);
      nav(`/settings/help/inquiries/${q.id}`, { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.inquiryNo(q.no)}
        backLabel={copy.back}
        onBack={() => nav(`/settings/help/inquiries/${q.id}`)}
      />
      <p>
        <strong>{copy.access24}</strong>
      </p>
      <section className="hg-stack" style={{ gap: 'var(--space-2)' }}>
        <SectionHeader title={copy.accessCan} />
        <ul className="hg-stack" style={{ gap: 'var(--space-1)', paddingLeft: 'var(--space-5)' }}>
          {r.scope.map((s) => (
            <li key={s}>{copy.accessScopes[s] ?? s}</li>
          ))}
        </ul>
        <p className="hg-q__help">{r.raw_amount ? copy.accessRaw : copy.accessRange}</p>
      </section>
      <section className="hg-stack" style={{ gap: 'var(--space-2)' }}>
        <SectionHeader title={copy.accessCannot} />
        <div className="hg-row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {copy.accessNever.map((t) => (
            <Badge key={t} kind="temp">
              {t}
            </Badge>
          ))}
        </div>
      </section>
      <div className="hg-row">
        <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>
          {copy.accessNo}
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => void answer(true)}>
          {copy.accessYes}
        </Button>
      </div>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
