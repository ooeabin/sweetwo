import { agreeTerms, fetchPendingTerms, qk } from '@sweetwo/api';
import { formatDateFull, todayKst } from '@sweetwo/core';
import { ConsentGroup, QuestionLayout, QuestionSkeleton } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { sharedCopy } from '../../../shared/copy';
import { toast } from '../../../shared/toast';
import { ConsentDocSheet, openPolicy } from '../consent-doc';
import { copy } from '../copy';
import { paths } from '../flow';

// A-05r 약관 개정 재동의(15 A-05 예외 “다음 실행 때 바뀐 필수 항목만 재동의”)와 마케팅 2년 재확인(15 A-05 3번).
// 바뀐 필수 항목(이용약관·개인정보)이 있으면 그 항목만 체크 → ‘동의하고 계속하기’. 마케팅만 남았으면 계속 받을지 묻기.
// ‘바뀐 점 보기’(2026-11-10): 바뀐 문서 원문(웹사이트 L-05, 시행일과 이전 버전)을 앱 안 브라우저로.
// 끝나면 들어오려던 화면으로(state.back).
export function A05rReconsent() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const back = (useLocation().state as { back?: string } | null)?.back ?? paths.home;
  const pending = useQuery({ queryKey: qk.pendingTerms, queryFn: fetchPendingTerms });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [doc, setDoc] = useState(false);
  if (pending.isLoading) return <QuestionSkeleton />;
  const list = pending.data ?? [];
  const required = list.filter((p) => p.kind !== 'marketing').map((p) => p.kind);
  const askMarketing = list.some((p) => p.kind === 'marketing');
  if (!list.length) return <Navigate to={back} replace />;

  const submit = async (marketing: boolean | null) => {
    if (saving) return;
    setSaving(true);
    setChoice(marketing);
    try {
      await agreeTerms(marketing);
      // 마케팅을 물었으면 처리 결과 통지(31 5-1): 날짜, 동의·거부, 보낸 곳. 알림 센터에도 남음(서버)
      if (marketing !== null)
        toast(sharedCopy.marketingResult(marketing, formatDateFull(todayKst())));
      await qc.invalidateQueries({ queryKey: qk.pendingTerms });
      nav(back, { replace: true });
    } catch {
      setSaving(false);
      toast(copy.reconsentFailed);
    }
  };

  if (!required.length) {
    // 2026-11-10 ‘그만 받을게요’는 제목 아래가 아니라 주 버튼 옆 회색 보조(좁은 창에서 반씩)
    return (
      <>
        <QuestionLayout
          title={copy.marketingAgainTitle}
          help={copy.marketingAgainHelp}
          primary={{ label: copy.marketingKeep, loading: saving && choice !== false }}
          secondary={{
            label: copy.marketingStop,
            onClick: () => void submit(false),
            loading: saving && choice === false,
          }}
          onSubmit={() => void submit(true)}
        >
          <p className="hg-help" style={{ margin: 0 }}>
            <button type="button" className="hg-btn hg-btn--link" onClick={() => setDoc(true)}>
              {copy.marketing.replace(/^\[선택\] /, '')} {copy.view}
            </button>
          </p>
        </QuestionLayout>
        {doc && <ConsentDocSheet doc="marketing" onClose={() => setDoc(false)} />}
      </>
    );
  }
  const ready = required.every((k) => checked[k]);
  return (
    <>
      <QuestionLayout
        title={copy.reconsentTitle}
        help={copy.reconsentHelp}
        primary={{ label: copy.agreeContinue, disabled: !ready, loading: saving }}
        onSubmit={() => void submit(askMarketing ? !!checked.marketing : null)}
      >
        <ConsentGroup
          allLabel={askMarketing ? copy.agreeAll : copy.agreeAll.replace('(선택 포함)', '')}
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
              viewLabel: copy.changesView,
              onView: () => openPolicy(k === 'terms' ? copy.termsUrl.terms : copy.termsUrl.privacy),
            })),
            ...(askMarketing
              ? [
                  {
                    key: 'marketing',
                    label: copy.marketing,
                    required: false,
                    onView: () => setDoc(true),
                  },
                ]
              : []),
          ]}
        />
      </QuestionLayout>
      {doc && <ConsentDocSheet doc="marketing" onClose={() => setDoc(false)} />}
    </>
  );
}
