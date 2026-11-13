import {
  addSplitLine,
  fetchPartnerPlanView,
  proposeSplit,
  qk,
  setSplitLine,
  splitAccountKeys,
  SplitProposeBlocked,
} from '@sweetwo/api';
import {
  coupleOf,
  incomeRatioAllowed,
  quickChips,
  readWon,
  splitShares,
  type PlanShare,
  type SplitRule,
} from '@sweetwo/core';
import {
  AmountInput,
  ChoiceCards,
  Chip,
  QuestionLayout,
  QuestionSkeleton,
  ShortText,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useMe, usePartner, useSpace, useSplits } from '../data';

type Step = 'name' | 'total' | 'rule' | 'custom';
const t = copy.splitShare;
const NAME_CHIPS = ['living', 'date'] as const;

// W-01b 분담 도우미(제안하는 쪽, 20 ‘W-01b’, 06 3-7, 08 4-1 (나)): 통장 이름(칩 ‘생활비 통장’ ‘데이트 통장’ + ‘직접 쓸게요’, 20자)
// → 한 달에 얼마(1만 원 단위) → 나누는 법 ‘반반’ / ‘월급 비율’ / ‘직접’ → 결과 “{나} 60만 원, {이름} 40만 원 (6 : 4)”
// → ‘{이름}님에게 제안하기’(propose_split, 상대 푸시·인앱 + 홈 띠 4번). 어느 관리 형태에서든.
// ‘월급 비율’은 두 사람 모두 월급이 있고 둘 다 공개 ‘모두 보여 주기’일 때만 고를 수 있고, 아니면 이유 문구 없이 흐린 선택지.
// 월급 비율 몫은 서버가 계산(미리 보기는 core splitShares로 같은 값, 월급 원값은 보이지 않음).
// 미합류면 제안 없이 내 몫만 내 월급 계획 ‘같이 쓰는 통장’ 줄로(‘내 월급 계획에 넣기’). 진입: 홈 띠 8번, W-01 “+ 같이 쓰는 통장”.
export function W01bSplitPropose() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const space = useSpace();
  const partner = usePartner();
  const splits = useSplits();
  const connected = space.data?.couple_state === 'connected' && !!partner.data;
  const view = useQuery({
    queryKey: qk.partnerPlanView(null),
    queryFn: () => fetchPartnerPlanView(),
    enabled: connected,
  });
  const [step, setStep] = useState<Step>('name');
  const [chip, setChip] = useState<(typeof NAME_CHIPS)[number] | 'self' | null>(null);
  const [own, setOwn] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [rule, setRule] = useState<SplitRule | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  if (
    me.isLoading ||
    space.isLoading ||
    partner.isLoading ||
    splits.isLoading ||
    (connected && view.isLoading)
  )
    return <QuestionSkeleton />;
  if (!me.data || !space.data) return <QuestionSkeleton />;
  const c = coupleOf(me.data, space.data, partner.data ?? null);
  const name = chip === 'self' ? own.trim() : chip ? (t.nameChips[chip] ?? '') : '';
  const nameCode = chip === 'living' || chip === 'date' ? chip : 'custom';
  const back = () => nav('/salary?view=plan');
  const unitOk = (v: number | null) => v !== null && v > 0 && v % 10_000 === 0;
  // 월급 비율: 두 사람 모두 ‘모두 보여 주기’ + 월급. 상대 값은 partner_plan_view가 ‘모두’일 때만 줌
  const ratioOk =
    connected &&
    !!view.data &&
    incomeRatioAllowed(
      { share: me.data.plan_share as PlanShare, income: me.data.monthly_income },
      { share: view.data.share, income: view.data.income },
    );
  const shares =
    total && rule
      ? splitShares(total, rule, {
          mineIncome: me.data.monthly_income,
          partnerIncome: view.data?.income ?? null,
          mine,
        })
      : null;

  const addMine = async () => {
    if (busy || !unitOk(total) || total === null) return;
    setBusy(true);
    try {
      // 내 월급 계획(각자 = 내 것, 합쳐서 = 공동)의 ‘같이 쓰는 통장’ 줄: 이미 있으면 금액만
      const sp =
        (splits.data ?? []).find((x) => x.owner_user_id === me.data?.id) ??
        (splits.data ?? []).find((x) => x.owner_user_id === null);
      if (!sp) throw new Error('no_split');
      const line = sp.split_line.find((l) => l.kind === 'shared_account');
      if (line) await setSplitLine(line.id, { amount: total });
      else await addSplitLine(sp.id, { kind: 'shared_account', amount: total });
      await Promise.all(splitAccountKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      carryToast(t.added);
      nav('/salary?view=plan', { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  const propose = async () => {
    if (busy || !total || !rule || !shares) return;
    setBusy(true);
    try {
      await proposeSplit({ name, total, rule, mine: rule === 'custom' ? (mine ?? 0) : undefined });
      track('split_proposed', { name_code: nameCode, rule });
      await Promise.all(splitAccountKeys.map((k) => qc.invalidateQueries({ queryKey: k })));
      carryToast(t.proposed(c.partnerName));
      nav('/salary?view=plan', { replace: true });
    } catch (e) {
      toast(
        e instanceof SplitProposeBlocked && e.reason === 'not_connected'
          ? t.notConnected
          : copy.failed,
      );
      setBusy(false);
    }
  };

  if (step === 'name') {
    const tooLong = [...own.trim()].length > 20;
    return (
      <QuestionLayout
        title={t.nameQ}
        onBack={back}
        primary={{ label: t.next, disabled: !name || tooLong }}
        onSubmit={() => name && !tooLong && setStep('total')}
      >
        <div className="hg-quick" role="radiogroup" aria-label={t.nameQ}>
          {NAME_CHIPS.map((k) => (
            <Chip
              key={k}
              small
              role="radio"
              aria-pressed={undefined}
              aria-checked={chip === k}
              selected={chip === k}
              onClick={() => setChip(k)}
            >
              {t.nameChips[k]}
            </Chip>
          ))}
          <Chip
            small
            role="radio"
              aria-pressed={undefined}
            aria-checked={chip === 'self'}
            selected={chip === 'self'}
            onClick={() => setChip('self')}
          >
            {t.nameSelf}
          </Chip>
        </div>
        {chip === 'self' && (
          <ShortText
            label={t.nameLabel}
            value={own}
            onChange={setOwn}
            max={20}
            error={tooLong ? t.tooLong : undefined}
          />
        )}
      </QuestionLayout>
    );
  }
  if (step === 'total')
    return (
      <QuestionLayout
        title={connected ? t.totalQ : t.mineQ}
        help={total !== null && !unitOk(total) ? t.unit : undefined}
        onBack={() => setStep('name')}
        primary={{
          label: connected ? t.next : t.addMine,
          disabled: !unitOk(total),
          loading: busy,
        }}
        onSubmit={() => (connected ? setStep('rule') : void addMine())}
      >
        <AmountInput
          label={connected ? t.totalQ : t.mineQ}
          value={total}
          onChange={setTotal}
          quick={quickChips.small.slice(1)}
          monthly
          embedded
        />
      </QuestionLayout>
    );
  if (step === 'custom') {
    const ok = mine !== null && mine >= 0 && mine % 10_000 === 0 && total !== null && mine <= total;
    return (
      <QuestionLayout
        title={t.customQ(c.myName)}
        help={
          mine !== null && total !== null && mine > total
            ? t.overTotal
            : mine !== null && mine % 10_000 !== 0
              ? t.unit
              : undefined
        }
        onBack={() => setStep('rule')}
        primary={{ label: t.propose(c.partnerName), disabled: !ok || !shares, loading: busy }}
        summary={
          shares
            ? t.result(
                c.myName,
                readWon(shares.mine),
                c.partnerName,
                readWon(shares.partner),
                shares.ratioTen[0],
                shares.ratioTen[1],
              )
            : undefined
        }
        onSubmit={() => void propose()}
      >
        <AmountInput
          label={t.customQ(c.myName)}
          value={mine}
          onChange={setMine}
          monthly
          embedded
          allowZero
        />
      </QuestionLayout>
    );
  }
  return (
    <QuestionLayout
      title={t.ruleQ}
      onBack={() => setStep('total')}
      primary={{
        label: rule === 'custom' ? t.next : t.propose(c.partnerName),
        disabled: !rule || (rule !== 'custom' && !shares),
        loading: busy,
      }}
      summary={
        shares && rule !== 'custom'
          ? t.result(
              c.myName,
              readWon(shares.mine),
              c.partnerName,
              readWon(shares.partner),
              shares.ratioTen[0],
              shares.ratioTen[1],
            )
          : undefined
      }
      onSubmit={() => (rule === 'custom' ? setStep('custom') : void propose())}
    >
      <ChoiceCards<SplitRule>
        label={t.ruleQ}
        value={rule}
        onChange={setRule}
        autoAdvance={false}
        options={(['half', 'income_ratio', 'custom'] as const).map((r) => ({
          value: r,
          label: t.rules[r] ?? r,
          // 이유 문구 없이 흐린 선택지(R3)
          disabled: r === 'income_ratio' && !ratioOk,
        }))}
      />
    </QuestionLayout>
  );
}
