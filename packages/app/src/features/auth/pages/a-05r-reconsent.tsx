import { agreeTerms, fetchPendingTerms, qk } from '@sweetwo/api';
import { Button, ConsentGroup, QuestionLayout } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { paths } from '../flow';

const view = (url: string) => () => window.open(url, '_blank', 'noopener,noreferrer');

// A-05r 약관 개정 재동의(15 A-05 예외 “다음 실행 때 바뀐 필수 항목만 재동의”)와 마케팅 2년 재확인(15 A-05 3번).
// 바뀐 필수 항목(이용약관·개인정보)이 있으면 그 항목만 체크 → ‘동의하고 계속하기’. 마케팅만 남았으면 계속 받을지 묻기.
// 끝나면 들어오려던 화면으로(state.back).
export function A05rReconsent() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const back = (useLocation().state as { back?: string } | null)?.back ?? paths.home;
  const pending = useQuery({ queryKey: qk.pendingTerms, queryFn: fetchPendingTerms });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  if (pending.isLoading) return null;
  const list = pending.data ?? [];
  const required = list.filter((p) => p.kind !== 'marketing').map((p) => p.kind);
  const askMarketing = list.some((p) => p.kind === 'marketing');
  if (!list.length) return <Navigate to={back} replace />;

  const submit = async (marketing: boolean | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await agreeTerms(marketing);
      await qc.invalidateQueries({ queryKey: qk.pendingTerms });
      nav(back, { replace: true });
    } catch {
      setSaving(false);
      toast(copy.reconsentFailed);
    }
  };

  if (!required.length) {
    return (
      <QuestionLayout
        title={copy.marketingAgainTitle}
        help={copy.marketingAgainHelp}
        primary={{ label: copy.marketingKeep, loading: saving }}
        onSubmit={() => void submit(true)}
      >
        <Button variant="ghost" onClick={() => void submit(false)} disabled={saving}>
          {copy.marketingStop}
        </Button>
      </QuestionLayout>
    );
  }
  const ready = required.every((k) => checked[k]);
  return (
    <QuestionLayout
      title={copy.reconsentTitle}
      help={copy.reconsentHelp}
      primary={{ label: copy.agreeContinue, disabled: !ready || saving, loading: saving }}
      onSubmit={() => void submit(askMarketing ? !!checked.marketing : null)}
    >
      <ConsentGroup
        allLabel={copy.agreeAll}
        checked={checked}
        onChange={setChecked}
        viewLabel={copy.view}
        requiredLabel={copy.requiredAll}
        foldLabel={copy.foldRequired}
        items={[
          ...required.map((k) => ({
            key: k,
            label: k === 'terms' ? copy.terms : copy.privacy,
            required: true,
            onView: view(k === 'terms' ? copy.termsUrl.terms : copy.termsUrl.privacy),
          })),
          ...(askMarketing
            ? [
                {
                  key: 'marketing',
                  label: copy.marketing,
                  required: false,
                  onView: view(copy.termsUrl.marketing),
                },
              ]
            : []),
        ]}
      />
    </QuestionLayout>
  );
}
