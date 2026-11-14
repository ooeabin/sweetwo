import type { PayCheckLine } from '@sweetwo/api';
import {
  daysBetween,
  kstDateOf,
  savingChips,
  savingMonthGain,
  savingPct,
  savingRemain,
  savingBar,
  type BundleViewResponse,
  type GoalMovePublic,
  type HeroItem,
  type MarriageStatus,
} from '@sweetwo/core';
import { SaveTogether, SaveTogetherEmpty, type SaveTogetherSlideProps } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { money, useMask } from '../../../shared/mask';
import { spoken } from '../../../shared/masked-text';
import { EMPTY_DRAFT, savingPaths, togetherPaths, writeDraft } from '../../salary';
import { copy } from '../copy';

/**
 * H-10 같이 모으기(19 ‘홈 v2.2’ 2번, 디자인 SaveTogether): 대표 저금(core pickHeroes, 최대 3칸 + ‘저금 모두 보기 ›’).
 * 칸: 사람(연결이면 둘, 미합류면 나) + 이름 → 큰 숫자 모은 금액(퍼센트만이면 %) → 오렌지 막대(목표 금액이 있을 때만)
 * → “목표 금액 …의 62%” → “이번 달 +…” → 기한 “…까지 n원 더 필요해요” → 각자 금액(둘 다 켰을 때만) → 해제 대기 멈춤.
 * 맨 아래 “+ 돈 들어왔어요” → W-20. 결혼 준비 중이면 머리 D-day 알약(예정일 없으면 “결혼식 날짜 알려 주기” → S-11h).
 * 저금이 하나도 없으면 빈 상태(질문 + 이름 칩 3개 → W-11a 이름 채움, ‘+ 저금 만들기’)
 */
export function H10SaveTogether({
  heroes,
  savedOf,
  people,
  peopleMine,
  joint,
  names,
  marriage,
  weddingDate,
  today,
  month,
  moves,
  savingCount,
  invite,
  go,
}: {
  heroes: HeroItem[];
  /** 저금 모은 금액(goal_saved) */
  savedOf: (id: string) => number;
  /** 사람(연결이면 둘). 묶음·공동 저금·합쳐서 저금 칸 */
  people: ReactNode;
  /** 나 하나. 각자 계열의 묶이지 않은 내 저금 칸(묶기 전엔 내 얼굴만, 2026-11-14) */
  peopleMine?: ReactNode;
  joint: boolean;
  names: { me: string; partner: string };
  marriage: MarriageStatus | null;
  weddingDate: string | null;
  today: string;
  /** 이번 달(대표 사이클) 범위와 확인 목록 줄(‘이번 달 +’) */
  month: { from: string; to: string; lines: PayCheckLine[] };
  moves: GoalMovePublic[];
  /** 모으는 중 저금 수(2개 이상이면 ‘저금 모두 보기’) */
  savingCount: number;
  /** 상대 저금 같이 모으기 권유(core bundleInviteGoal). 빈 상태 질문 자리에 한 번만(띠 13 대신, 2026-11-14 R4) */
  invite?: { name: string; to: string } | null;
  go: (box: 'together' | 'money_in' | 'more' | 'chip' | 'dday', to: string) => void;
}) {
  const { masked } = useMask();
  const won = (v: number) => money(v, masked);
  const gain = (ids: string[]) =>
    savingMonthGain(ids, {
      lines: month.lines,
      moves: moves.map((m) => ({ ...m, on: kstDateOf(m.created_at) })),
      from: month.from,
      to: month.to,
    });

  // 결혼 준비 중 D-day 알약(19 2번)
  const engaged = marriage === 'engaged';
  const dday = engaged && weddingDate ? daysBetween(today, weddingDate) : null;
  const head = !engaged ? undefined : dday !== null && dday >= 0 ? (
    <span className="hg-hubtile__badge">{dday === 0 ? copy.ddayToday : copy.dday(dday)}</span>
  ) : dday === null ? (
    <button
      type="button"
      className="hg-btn hg-btn--link"
      onClick={() => go('dday', '/settings/me/wedding')}
    >
      {copy.weddingDateAsk}
    </button>
  ) : undefined;

  if (!heroes.length) {
    // 빈 상태: 이름 칩(19 ‘이름 칩 표’, core savingChips) → W-11a에 이름을 채워 시작
    const start = (name: string) => {
      writeDraft({ ...EMPTY_DRAFT, name });
      go('chip', `${savingPaths.add}/a?from=home`);
    };
    return (
      <SaveTogetherEmpty
        className="hg-hub__wide"
        title={copy.together}
        head={head}
        question={invite ? copy.taskBundle(names.partner, invite.name) : copy.emptyAsk}
        chips={
          invite
            ? [{ label: copy.inviteJoin, onClick: () => go('together', invite.to) }]
            : savingChips(marriage).map((c) => ({
                label: copy.chips[c],
                onClick: () => start(copy.chips[c]),
              }))
        }
        add={{
          label: copy.emptyAdd,
          onClick: () => {
            writeDraft(null);
            go('chip', `${savingPaths.add}/a?from=home`);
          },
        }}
      />
    );
  }

  const bundleSlide = (b: BundleViewResponse): SaveTogetherSlideProps => {
    const done = b.status === 'achieved' || (b.pct !== null && b.pct >= 100);
    const lines: string[] = [];
    const say: string[] = [b.name];
    // 아직 안 들어간 묶음(상대가 만듦): 첫 줄에 권유, 누르면 들어가기(2026-11-14 H1, 홈 띠가 가려도 보이게)
    const invited = !b.goals.some((x) => x.mine);
    if (invited) {
      lines.push(copy.togetherInvite(names.partner));
      say.push(copy.togetherInvite(names.partner));
    }
    if (b.percent_only) {
      // 퍼센트만(G1): 금액 대신 %, 목표 금액 문장·‘이번 달 +’·각자 금액 없음, 기한은 달만
      say.push(`${b.pct ?? 0}%`);
      if (b.deadline && !done) {
        lines.push(copy.remainPercent(b.deadline));
        say.push(copy.remainPercent(b.deadline));
      }
    } else {
      const total = b.total ?? 0;
      // 큰 숫자는 묶음 합계(둘이 모은 금액). 월급 탭 저금 줄은 ‘내 몫’(2026-11-14 R4: 화면마다 숫자가 달라 보였음)
      if (!invited) lines.push(copy.bothSaved);
      say.push(copy.bothSaved, won(total));
      if (b.target !== null && b.pct !== null) {
        lines.push(copy.targetOf(won(b.target), b.pct));
        say.push(copy.targetPctLabel(b.pct));
      }
      // 이번 달 +: 서버 묶음 값(상대 움직임을 못 봐도 합계와 같은 기준, 2026-11-14 M1). 옛 응답이면 앱 계산
      const g = b.month_gain ?? gain(b.goals.map((x) => x.id));
      if (g > 0) lines.push(copy.thisMonthGain(won(g)));
      const r = done
        ? null
        : savingRemain({ target: b.target, saved: total, deadline: b.deadline });
      if (r) {
        lines.push(copy.remain(r.deadline, won(r.remain)));
        say.push(copy.remain(r.deadline, won(r.remain)));
      }
      if (b.show_each && b.mine !== null && b.partner !== null)
        lines.push(copy.each(names.me, won(b.mine), names.partner, won(b.partner)));
    }
    if (b.paused) lines.push(copy.paused);
    return {
      people,
      name: b.name,
      amount: b.percent_only ? `${b.pct ?? 0}%` : won(b.total ?? 0),
      bar: b.target !== null || b.percent_only ? (b.pct ?? 0) : null,
      lines,
      done: done ? copy.doneBadge : undefined,
      paused: b.paused,
      percentOnly: b.percent_only,
      label: spoken(copy.togetherLabel(say)),
      // 묶음 입구(BundleEntry): 안 들어갔으면 들어가기(W-15), 처음 보는 달성이면 W-12, 아니면 내 저금 W-10(2026-11-14 H1)
      onClick: () => go('together', togetherPaths.bundle(b.id)),
    };
  };

  const goalSlide = (g: Extract<HeroItem, { kind: 'goal' }>['goal']): SaveTogetherSlideProps => {
    const saved = savedOf(g.id);
    const pct = savingPct(saved, g.target_amount);
    const lines: string[] = [];
    const say: string[] = [g.name, won(saved)];
    if (g.target_amount !== null && pct !== null) {
      lines.push(copy.targetOf(won(g.target_amount), pct));
      say.push(copy.targetPctLabel(pct));
    }
    const m = gain([g.id]);
    if (m > 0) lines.push(copy.thisMonthGain(won(m)));
    const r = savingRemain({ target: g.target_amount, saved, deadline: g.deadline });
    if (r) {
      lines.push(copy.remain(r.deadline, won(r.remain)));
      say.push(copy.remain(r.deadline, won(r.remain)));
    }
    return {
      people: !joint && g.owner_user_id !== null ? (peopleMine ?? people) : people,
      name: g.name,
      amount: won(saved),
      bar: g.target_amount !== null ? savingBar(saved, g.target_amount) : null,
      lines,
      label: spoken(copy.togetherLabel(say)),
      onClick: () => go('together', savingPaths.item(g.id)),
    };
  };

  return (
    <SaveTogether
      className="hg-hub__wide"
      title={copy.together}
      label={copy.together}
      head={head}
      slides={heroes.map((h) => (h.kind === 'bundle' ? bundleSlide(h.bundle) : goalSlide(h.goal)))}
      more={
        savingCount >= 2
          ? {
              label: copy.seeAll,
              onClick: () => go('more', `${savingPaths.list}?from=home`),
            }
          : undefined
      }
      moneyIn={{ label: copy.moneyIn, onClick: () => go('money_in', '/salary/money-in') }}
    />
  );
}
