import { ensureMonthClose, updateMonthClose } from '@sweetwo/api';
import { QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { closePath, useCloseData } from '../data';

// W-04a 시작(docs/spec/21-month-close.md). ‘시작’을 누른 사람이 정리자.
// 배우자 합류 뒤 같이 하기, 보기만(함께 모드)은 실시간 동기화 단계에서.
export function W04aStart() {
  const nav = useNavigate();
  const d = useCloseData();
  const [saving, setSaving] = useState(false);
  if (d.loading) return null;

  const start = async () => {
    if (!d.planId || !d.me || saving) return;
    setSaving(true);
    try {
      const id = await ensureMonthClose(d.planId);
      if (!d.close?.started_at)
        await updateMonthClose(id, { started_by: d.me.id, started_at: new Date().toISOString() });
      await d.refreshClose();
      nav(closePath('w-04j'));
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
              {copy.startAlone(d.space?.partner_nickname ?? '')}
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
