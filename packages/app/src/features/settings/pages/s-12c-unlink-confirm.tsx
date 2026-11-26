import { qk, requestUnlink } from '@sweetwo/api';
import { todayKst } from '@sweetwo/core';
import { Field, FormScreen, FormSection, QuestionSkeleton } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOnline } from '../../../shared/online';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { exportedRecently } from '../unlink';

/** 함께 쓴 개월 수(공간 만든 달부터). 값이 없거나 깨졌으면 0 */
function monthsSince(at: string | undefined): number {
  const t = at ? Date.parse(at) : NaN;
  if (Number.isNaN(t)) return 0;
  const [y0 = 0, m0 = 0] = todayKst(new Date(t)).split('-').map(Number);
  const [y1 = 0, m1 = 0] = todayKst().split('-').map(Number);
  return Math.max(0, (y1 - y0) * 12 + (m1 - m0));
}

// S-12c 해제 확인 입력(Q5, 2026-11-24 스테퍼 2/2): “연결 해제”라고 입력해야 ‘연결 해제 요청하기’ 활성. 보내면 해제 대기 → S-12, 상대 알림(서버)
export function S12cUnlinkConfirm() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // 오프라인이면 요청 비활성 + 이유 한 줄(25 예외, 2026-11-11 S3-08)
  const online = useOnline();
  if (d.loading || !d.c) return <QuestionSkeleton />;
  const c = d.c;
  const ok = text.trim() === copy.confirmWord;
  const send = async () => {
    if (!ok || busy || !online) return;
    setBusy(true);
    try {
      await requestUnlink(copy.confirmWord);
      track('unlink_requested', {
        linked_months: monthsSince(d.space?.created_at),
        exported_data: exportedRecently(),
      });
      await Promise.all([qk.space, qk.unlink].map((k) => qc.invalidateQueries({ queryKey: k })));
      carryToast(copy.sent(c.partnerName));
      nav('/settings/couple', { replace: true });
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormScreen
      title={copy.unlink}
      onBack={() => nav('/settings/couple/unlink')}
      step={{ index: 2, total: 2 }}
      primary={{ label: copy.send, disabled: !ok || !online, loading: busy }}
      onSubmit={() => void send()}
    >
      <FormSection title={copy.confirmQ}>
        <Field
          label={copy.confirmWord}
          value={text}
          placeholder={copy.confirmWord}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        {!online && <p className="hg-help is-error">{copy.needOnline}</p>}
      </FormSection>
    </FormScreen>
  );
}
