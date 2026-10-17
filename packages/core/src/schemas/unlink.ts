import { z } from 'zod';
import type { UnlinkItem } from '../rules/unlink';

// 연결 해제 자산 정리 안(couple_unlink.plan, 서버 request_unlink가 만듦). mine = 요청한 사람 몫
const won = z.number().int().nonnegative();
const PlanRow = z.object({ asset_id: z.string(), name: z.string(), amount: won, mine: won });

/** 깨진 줄은 빼고 읽음 */
export function readUnlinkPlan(v: unknown): UnlinkItem[] {
  if (!Array.isArray(v)) return [];
  const out: UnlinkItem[] = [];
  for (const row of v) {
    const r = PlanRow.safeParse(row);
    if (r.success && r.data.mine <= r.data.amount)
      out.push({
        assetId: r.data.asset_id,
        name: r.data.name,
        amount: r.data.amount,
        mine: r.data.mine,
      });
  }
  return out;
}
