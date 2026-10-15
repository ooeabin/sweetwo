import {
  respondProposal,
  withdrawProposal,
  type Proposal,
  type ProposalStatus,
} from '@sweetwo/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { recalcPendingShares, refreshAfterChange } from './data';

/** 제안 응답·취소(G-08, G-02 제안 중 카드). who = 제안한 사람, partner = 상대 호칭. 끝나면 onDone */
export function useProposalActions(
  p: Pick<Proposal, 'id'> | null,
  o: { who: string; partner: string; onDone?: () => void },
) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = async (act: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await act();
    } catch {
      toast(copy.saveFailed, { label: copy.retry, onClick: () => void run(act) });
    } finally {
      setBusy(false);
    }
  };
  const after = async (status: ProposalStatus, ok: ProposalStatus, okText: string) => {
    if (status === ok) {
      if (status === 'applied') await recalcPendingShares();
      toast(okText);
    } else if (status === 'withdrawn') toast(copy.withdrawnBy(o.who));
    else toast(copy.answeredBy(o.partner));
    await refreshAfterChange(qc);
    o.onDone?.();
  };

  return {
    busy,
    run,
    like: () =>
      p && run(async () => after(await respondProposal(p.id, 'like'), 'applied', copy.liked)),
    oppose: () =>
      p && run(async () => after(await respondProposal(p.id, 'oppose'), 'held', copy.opposed)),
    withdraw: () =>
      p && run(async () => after(await withdrawProposal(p.id), 'withdrawn', copy.withdrawn)),
  };
}
