import { configureSplitLines, dismissHomeTask, qk, type SplitLine } from '@sweetwo/api';
import { TASK_KEYS } from '@sweetwo/core';
import { BottomSheet, Button, Checkbox } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { sharedCopy } from '../../../shared/copy';
import { money, useMask } from '../../../shared/mask';
import { toast } from '../../../shared/toast';
import { goalLineName } from '../check-line';
import { copy } from '../copy';
import { autoPickable, baseDayOf, nextDayOf } from '../cycle';
import { useGoals, useMe, usePartner, useSpace, useSplits, useSplitWrite } from '../data';
import { salaryPaths } from '../paths';
import { AutoDayPick } from '../receipt-parts';
import { W01Receipt } from './w-01-receipt';

type AutoPick = { on: boolean; day: number | null };

/**
 * W-01d 자동으로 나가는 것 고르기(20 ‘월급 탭 v2.2’ W-01d, G6). 월급 계획(W-01) 위 BottomSheet, 주소 /salary/auto-lines
 * (홈 띠 9번). 저금·고정지출·같이 쓰는 통장 줄 + 줄마다 체크 + 체크하면 그 줄 아래 나가는 날(처음 값 월급날).
 * ‘저장하기’ = 고른 줄 auto_pay 켬(split_lines_configure 여러 줄 한 번에) + 띠 9번 끝냄. “자동으로 나가는 게 없어요” = 아무것도
 * 켜지 않고 띠 9번 끝냄(home_task_state auto_pick). 닫으면 월급 계획(W-01)
 */
export function W01dAutoLines() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const goals = useGoals();
  const splits = useSplits();
  const write = useSplitWrite();
  const { masked } = useMask();
  const [picks, setPicks] = useState<Record<string, AutoPick>>({});
  const [busy, setBusy] = useState(false);
  const close = () => nav(salaryPaths.plan, { replace: true });

  const m = me.data;
  const sp = space.data;
  const joint = sp?.salary_mode === 'joint';
  const split = (splits.data ?? []).find((x) =>
    joint ? x.owner_user_id === null : x.owner_user_id === m?.id,
  );
  const lines = [...(split?.split_line ?? [])].filter(autoPickable).sort((a, b) => a.sort - b.sort);
  const base = m && sp ? baseDayOf(m, sp) : null;
  const pickOf = (l: SplitLine): AutoPick => picks[l.id] ?? { on: l.auto_pay, day: l.auto_day };
  const personName = (id: string | null) =>
    id === m?.id ? (m?.nickname ?? '') : (partner.data?.nickname ?? null);
  const goalName = goalLineName(goals.data ?? [], personName, joint);
  const nameOf = (l: SplitLine) =>
    l.kind === 'saving'
      ? goalName(l.goal_id)
      : l.kind === 'shared_account'
        ? (l.name ?? copy.sharedAccountName)
        : copy.lineNames.fixed;

  const finish = async (answer: 'yes' | 'no') => {
    await dismissHomeTask(TASK_KEYS.autoPick, 'done').catch(() => undefined);
    await qc.invalidateQueries({ queryKey: qk.homeTasks });
    track('auto_pay_asked', { screen_id: 'W-01d', answer });
  };
  const save = async () => {
    if (busy) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return toast(sharedCopy.needOnline);
    setBusy(true);
    try {
      const changed = lines
        .map((l) => ({ l, p: pickOf(l) }))
        .filter(({ l, p }) => p.on !== l.auto_pay || (p.on && p.day !== l.auto_day));
      if (changed.length)
        await write(() =>
          configureSplitLines(
            changed.map(({ l, p }) => ({ id: l.id, autoPay: p.on, autoDay: p.on ? p.day : null })),
          ),
        );
      const next = nextDayOf(base);
      for (const { l, p } of changed)
        track('split_line_setting_changed', {
          kind: l.kind,
          in_checklist: l.in_checklist,
          auto_pay: p.on,
          auto_day_band: !p.on
            ? 'none'
            : p.day === null
              ? 'payday'
              : p.day === next
                ? 'next'
                : 'other',
        });
      await finish(lines.some((l) => pickOf(l).on) ? 'yes' : 'no');
      toast(copy.autoPickSaved);
      close();
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <W01Receipt />
      {split && (
        <BottomSheet
          title={copy.autoPickTitle}
          onClose={close}
          closeLabel={copy.close}
          actions={
            <>
              <Button block variant="primary" loading={busy} onClick={() => void save()}>
                {copy.autoPickSave}
              </Button>
              <button
                type="button"
                className="hg-btn hg-btn--link"
                style={{ alignSelf: 'center', minHeight: 'var(--space-10)' }}
                onClick={() =>
                  void finish('no').then(() => {
                    close();
                  })
                }
              >
                {copy.autoPickNone}
              </button>
            </>
          }
        >
          <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
            {lines.length === 0 && <p className="hg-help">{copy.autoPickEmpty}</p>}
            {lines.map((l) => {
              const p = pickOf(l);
              return (
                <div key={l.id} className="hg-stack" style={{ gap: 'var(--space-2)' }}>
                  <Checkbox
                    label={`${nameOf(l)} ${money(l.amount, masked)}`}
                    checked={p.on}
                    onChange={(on) => setPicks({ ...picks, [l.id]: { ...p, on } })}
                  />
                  {p.on && (
                    <AutoDayPick
                      label={`${nameOf(l)} ${copy.autoDay}`}
                      value={p.day}
                      payday={base}
                      onChange={(day) => setPicks({ ...picks, [l.id]: { ...p, day } })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
