import { ensureMonthClose, joinCloseTogether, qk, updateMonthClose } from '@sweetwo/api';
import { QuestionLayout } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath, useCloseData } from '../data';
import { useCloseMode, useTogether, useTogetherActive } from '../together';

// W-04a 시작(docs/spec/21-month-close.md). ‘시작’을 누른 사람이 정리자.
// 배우자가 이미 시작했으면 “찬우님이 정리 중이에요” + 지금 단계 + ‘같이 하기’(함께 모드, 지금 단계로 합류) / ‘보기만’(읽기 전용, 따라 이동).
export function W04aStart() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useCloseData();
  const mode = useCloseMode();
  const active = useTogetherActive();
  const others = useTogether((x) => x.others);
  const setView = useTogether((x) => x.setView);
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;
  const firstStep = d.me?.income_variable ? 'w-04a2' : 'w-04j';
  const partnerStep = others[0]?.step;
  const joinStep = partnerStep && partnerStep !== 'w-04a' ? partnerStep : firstStep;

  // 배우자가 정리 중(나는 정리자가 아님)
  const closer = d.close?.started_by;
  if (
    d.joined &&
    d.close &&
    closer &&
    closer !== d.me?.id &&
    d.close.status !== 'done' &&
    mode !== 'together'
  ) {
    const join = async () => {
      if (!d.close || saving) return;
      setSaving(true);
      try {
        await joinCloseTogether(d.close.id);
        setView(false);
        await qc.invalidateQueries({ queryKey: qk.monthClose(d.planId ?? '') });
        nav(closePath(joinStep));
      } catch {
        setSaving(false);
        toast(copy.saveFailed, { label: copy.retry, onClick: () => void join() });
      }
    };
    return (
      <QuestionLayout
        title={copy.closing(d.partnerName)}
        help={
          <>
            {copy.closingHelp}
            {partnerStep && copy.stepNames[partnerStep] && (
              <>
                <br />
                {copy.closingStep(copy.stepNames[partnerStep] ?? '')}
              </>
            )}
          </>
        }
        onBack={() => nav('/')}
        primary={{ label: copy.joinTogether, loading: saving }}
        onSubmit={() => void join()}
        later={{
          label: copy.viewOnly,
          onClick: () => {
            setView(true);
            nav(closePath(joinStep));
          },
        }}
      />
    );
  }

  const start = async () => {
    if (!d.planId || !d.me || saving) return;
    setSaving(true);
    try {
      const id = await ensureMonthClose(d.planId);
      if (!d.close?.started_at)
        await updateMonthClose(id, { started_by: d.me.id, started_at: new Date().toISOString() });
      await d.refreshClose();
      nav(closePath(firstStep));
    } catch {
      setSaving(false);
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void start() });
    }
  };

  return (
    <QuestionLayout
      title={copy.startTitle(d.month)}
      help={
        <>
          {copy.startHelp}
          {d.joined && (
            <>
              <br />
              {active ? copy.togetherNow : copy.startAlone(d.partnerName)}
            </>
          )}
        </>
      }
      onBack={() => nav('/')}
      primary={{ label: copy.start, disabled: !d.planId, loading: saving }}
      onSubmit={() => void start()}
    />
  );
}
