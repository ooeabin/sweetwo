import type { PayCheckLine } from '@sweetwo/api';
import {
  daysBetween,
  kstDateOf,
  savingMonthGain,
  savingPct,
  savingArtKey,
  savingRemain,
  type BundleViewResponse,
  type GoalMovePublic,
  type HeroItem,
  type MarriageStatus,
} from '@sweetwo/core';
import {
  Illustration,
  SaveTogether,
  type SaveTogetherSay,
  type SaveTogetherSlideProps,
} from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { money, useMask } from '../../../shared/mask';
import { spoken } from '../../../shared/masked-text';
import { copy } from '../copy';

/**
 * H-10 같이 모으기(19 ‘홈 v2.2’ 3번, 디자인 SaveTogether): 대표 저금(core pickHeroes, 최대 3칸 + 점).
 * 2026-11-26 사용자 결정 ‘같이 모으기 C안’(문장형): 진행 막대·보조 줄 없음. 칸 = 그림(core `savingArtKey`, 파일이 없으면 자리째 없음)
 * + 이름표(저금 이름) → 큰 숫자 모은 금액(퍼센트만이면 %) → 문장 한 줄: 목표 금액이 있으면 “목표까지 n원 남았어요”(금액만 오렌지),
 * 다 모았으면 “다 모았어요”, 목표 금액이 없으면 “이번 달 +n원 모았어요”, 둘 다 없으면 문장 없음, 해제 대기면 “같이 모으기를 잠시 멈췄어요”,
 * 퍼센트만이면 문장 없음(금액 자리 “n%”). 기한 “…까지 n원 더 필요해요”는 화면 읽기에만.
 * 결혼 준비 중이면 머리 D-day 알약(예정일 없으면 “결혼식 날짜 알려 주기” → S-11h).
 * 사람 원은 머리 “같이 모으기” 바로 오른쪽 작은 겹친 Avatar(sm 24, 지금 보이는 칸 기준: 연결이면 둘, 미합류·각자 계열 내 저금 칸이면 나).
 * 2026-11-18: 누를 수 없는 정보 상자. 같이 모으기 항목이 하나도 없으면 홈이 이 상자를 그리지 않음
 */
export function H10SaveTogether({
  heroes,
  savedOf,
  people,
  peopleMine,
  joint,
  marriage,
  weddingDate,
  today,
  month,
  moves,
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
  marriage: MarriageStatus | null;
  weddingDate: string | null;
  today: string;
  /** 이번 달(대표 사이클) 범위와 확인 목록 줄(‘이번 달 +’) */
  month: { from: string; to: string; lines: PayCheckLine[] };
  moves: GoalMovePublic[];
  go: (box: 'dday', to: string) => void;
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

  type Slide = SaveTogetherSlideProps & { owners?: ReactNode };
  // 칸 왼쪽 그림 40px(파일이 없으면 Illustration이 null → 자리 없음, 2026-11-26)
  const art = (name: string) => (
    <Illustration name={savingArtKey(name, copy.chips)} className="hg-together__art" />
  );

  // C안 문장 한 줄(2026-11-26 사용자 결정 ‘같이 모으기 C안’): 멈춤 → 다 모음 → 목표 금액까지 남은 금액(퍼센트만이면 문장 없음)
  // → 목표 금액이 없으면 이번 달 + → 둘 다 없으면 문장 없음
  const sayOf = (o: {
    paused?: boolean;
    done: boolean;
    percentOnly?: boolean;
    pct: number | null;
    target: number | null;
    saved: number;
    gain: number;
  }): SaveTogetherSay | undefined => {
    if (o.paused) return copy.paused;
    if (o.done) return copy.doneBadge;
    // 퍼센트만이면 금액 자리가 이미 “62%”라 문장 없음(2026-11-26 사용자 결정, 같은 숫자 두 번 안 보임)
    if (o.percentOnly) return undefined;
    if (o.target !== null)
      return { lead: copy.leftLead, em: won(Math.max(0, o.target - o.saved)), tail: copy.leftTail };
    return o.gain > 0 ? copy.monthSaved(won(o.gain)) : undefined;
  };

  const bundleSlide = (b: BundleViewResponse): Slide => {
    const done = b.status === 'achieved' || (b.pct !== null && b.pct >= 100);
    const say: string[] = [b.name];
    const total = b.total ?? 0;
    // 큰 숫자는 묶음 합계(둘이 모은 금액). 각자 금액 줄·아직 안 들어간 묶음 권유 줄은 칸에서 뺌(2026-11-26 C안:
    // 각자 금액은 W-10 묶음 카드, 안 들어간 묶음은 알림 “…같이 모아요”·W-01 5d 묶음 줄 → W-10 0c ‘같이 모으기에 들어가기’)
    if (b.percent_only) {
      // 퍼센트만(G1): 금액 대신 %, 기한은 달만(화면 읽기)
      say.push(`${b.pct ?? 0}%`);
      if (b.deadline && !done) say.push(copy.remainPercent(b.deadline));
    } else {
      say.push(won(total));
      if (b.target !== null && b.pct !== null) say.push(copy.targetPctLabel(b.pct));
      const r = done
        ? null
        : savingRemain({ target: b.target, saved: total, deadline: b.deadline });
      if (r) say.push(copy.remain(r.deadline, won(r.remain)));
    }
    if (b.paused) say.push(copy.paused);
    return {
      owners: people,
      art: art(b.name),
      name: b.name,
      amount: b.percent_only ? `${b.pct ?? 0}%` : won(total),
      bar: null,
      say: sayOf({
        paused: b.paused,
        done,
        percentOnly: b.percent_only,
        pct: b.pct,
        target: b.target,
        saved: total,
        gain: b.percent_only ? 0 : (b.month_gain ?? gain(b.goals.map((x) => x.id))),
      }),
      paused: b.paused,
      percentOnly: b.percent_only,
      label: spoken(copy.togetherLabel(say)),
    };
  };

  const goalSlide = (g: Extract<HeroItem, { kind: 'goal' }>['goal']): Slide => {
    const saved = savedOf(g.id);
    const pct = savingPct(saved, g.target_amount);
    const say: string[] = [g.name, won(saved)];
    const solo = !joint && g.owner_user_id !== null;
    if (g.target_amount !== null && pct !== null) say.push(copy.targetPctLabel(pct));
    // 기한 “…까지 n원 더 필요해요”는 칸에 쓰지 않고 화면 읽기에만(2026-11-20, C안도 그대로)
    const r = savingRemain({ target: g.target_amount, saved, deadline: g.deadline });
    if (r) say.push(copy.remain(r.deadline, won(r.remain)));
    return {
      owners: solo ? (peopleMine ?? people) : people,
      art: art(g.name),
      name: g.name,
      amount: won(saved),
      bar: null,
      say: sayOf({
        done: g.target_amount !== null && saved >= g.target_amount,
        pct,
        target: g.target_amount,
        saved,
        gain: gain([g.id]),
      }),
      label: spoken(copy.togetherLabel(say)),
    };
  };

  return (
    <SaveTogether
      className="hg-hub__wide"
      title={copy.together}
      label={copy.together}
      head={head}
      variant="sentence"
      slides={heroes.map((h) => (h.kind === 'bundle' ? bundleSlide(h.bundle) : goalSlide(h.goal)))}
    />
  );
}
