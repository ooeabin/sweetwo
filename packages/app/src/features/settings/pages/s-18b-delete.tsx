import { fetchAssets, qk, requestAccountDeletion } from '@sweetwo/api';
import { formatMonthDay } from '@sweetwo/core';
import { Button, Modal, PageHeader } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { paths, prefs, providerName, reauthenticate, session } from '../../auth';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-18b 계정 삭제 확인(docs/spec/25-settings.md, 31 3-2): 삭제 대상(부부 상태별), ‘먼저 내보내기’,
// “카카오로 확인하고 삭제” → 확인 Modal → 가입 소셜로 다시 로그인(10분 안이면 생략) → 돌아오면(?go=1) 삭제 요청 →
// 바로 로그아웃, A-02에 “계정 삭제 요청을 받았어요. 11월 17일까지 다시 로그인하면 취소할 수 있어요”.
// 구독 해지 안내는 구독과 함께.
export function S18bDelete() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const d = useSettingsData();
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const auto = useRef(false);

  const go = async () => {
    setBusy(true);
    try {
      const r = await requestAccountDeletion();
      if (r === 'reauth') {
        const w = await reauthenticate('/settings/data/delete?go=1');
        if (w.wait) nav(w.wait);
        return;
      }
      await session.signOut();
      prefs.setReturnTo(null);
      nav(paths.login, {
        replace: true,
        state: { notice: copy.deletedNotice(formatMonthDay(r.until)) },
      });
    } catch {
      toast(copy.failed);
      setBusy(false);
      setAsk(false);
    }
  };

  // 다시 로그인하고 돌아오면 이어서 삭제
  useEffect(() => {
    if (params.get('go') !== '1' || auto.current || d.loading) return;
    auto.current = true;
    setParams({}, { replace: true });
    void go();
  }, [d.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading || !d.me || !d.c || !d.space || assets.isLoading)
    return <MainFrame current={null} columns={[null]} />;
  const { me, c, space } = d;
  const n = (assets.data ?? []).filter(
    (a) => a.owner === 'person' && a.owner_user_id === me.id,
  ).length;
  const joined = space.couple_state === 'connected' || space.couple_state === 'unlink_pending';
  const lines = [
    copy.deleteMine(n),
    joined ? copy.deleteJointStays(c.partnerName) : copy.deleteWholeSpace,
    ...(space.couple_state === 'unlink_pending' ? [copy.deletePendingNote(c.partnerName)] : []),
    copy.deleteRestore,
  ];
  const provider = me.provider ? providerName[me.provider] : '';

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.deleteAccount}
        backLabel={copy.back}
        backTo={copy.data}
        onBack={() => nav('/settings/data')}
      />
      <ul className="hg-stack" style={{ gap: 'var(--space-2)', paddingLeft: 'var(--space-5)' }}>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div className="hg-row" style={{ flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => nav('/settings/data')}>
          {copy.exportFirst}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => setAsk(true)}>
          {copy.deleteWith(provider)}
        </Button>
      </div>
      {ask && (
        <Modal
          title={copy.deleteQ}
          body={copy.deleteRestore}
          confirmLabel={copy.deleteWith(provider)}
          cancelLabel={copy.cancel}
          busy={busy}
          onConfirm={() => void go()}
          onCancel={() => setAsk(false)}
        />
      )}
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
