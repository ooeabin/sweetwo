import { answerAssetShare, qk } from '@sweetwo/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { F03eShare, type ShareVis } from './f-03e-share';

/**
 * F-03e 연결할 때(23 ‘F-03e 연결할 때’, 2026-11-16 5차 검토 B5) [확인 필요]: 혼자 쓸 때 ‘모두’로 적은 내 명의 자산은 연결
 * 순간 서버가 숨겨 둠(asset.share_pending). 홈 띠 5a → 이 화면에서 한 번 고름(미리 고른 값 없음, F-03e와 같은 선택지) →
 * answer_asset_share(숨겨 둔 자산을 고른 값으로, 기본값이 없으면 기본값도) → 홈 + Toast. 주소 /assets/share
 */
export function F03eShareConnect() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [vis, setVis] = useState<ShareVis | null>(null);
  const [saving, setSaving] = useState(false);
  const home = () => nav('/', { replace: true });
  const save = async () => {
    if (saving || vis === null) return;
    setSaving(true);
    try {
      const count = await answerAssetShare(vis);
      track('asset_share_answered', { share: vis, count });
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.assets }),
        qc.invalidateQueries({ queryKey: qk.me }),
      ]);
      carryToast(copy.shareConnectDone);
      home();
    } catch {
      toast(copy.saveFailed);
      setSaving(false);
    }
  };
  return (
    <F03eShare
      value={vis}
      onChange={setVis}
      onSubmit={() => void save()}
      onBack={() => nav('/')}
      primaryLabel={copy.shareConnectSave}
      loading={saving}
      help={copy.shareConnectHelp}
    />
  );
}
