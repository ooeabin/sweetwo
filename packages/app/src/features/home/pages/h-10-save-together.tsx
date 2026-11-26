import type { PayCheckLine } from '@sweetwo/api';
import {
  daysBetween,
  kstDateOf,
  savingMonthGain,
  savingPct,
  savingArtKey,
  savingRemain,
  savingBar,
  type BundleViewResponse,
  type GoalMovePublic,
  type HeroItem,
  type MarriageStatus,
} from '@sweetwo/core';
import { Illustration, SaveTogether, type SaveTogetherSlideProps } from '@sweetwo/ui';
import type { ReactNode } from 'react';
import { money, useMask } from '../../../shared/mask';
import { spoken } from '../../../shared/masked-text';
import { copy } from '../copy';

/**
 * H-10 같이 모으기(19 ‘홈 v2.2’ 2번, 디자인 SaveTogether): 대표 저금(core pickHeroes, 최대 3칸 + ‘저금 모두 보기 ›’).
 * 칸: 사람(연결이면 둘, 미합류면 나) + 이름 → 큰 숫자 모은 금액(퍼센트만이면 %) → 오렌지 막대(목표 금액이 있을 때만)
 * → 보조 한 줄(목표 금액이 있으면 “62%, 5,000만 원 중”, 없으면 “이번 달 +190만 원”, 2026-11-20) → 각자 금액(둘 다 켰을 때만) → 해제 대기 멈춤.
 * 기한 “…까지 n원 더 필요해요”는 카드에서 빼고 화면 읽기에만 남김.
 * 결혼 준비 중이면 머리 D-day 알약(예정일 없으면 “결혼식 날짜 알려 주기” → S-11h).
 * 2026-11-26 사용자 결정: 칸 왼쪽 = 그 저축·투자의 그림(core `savingArtKey`, 파일이 없으면 자리째 없음),
 * 사람 원은 머리 “같이 모으기” 바로 오른쪽 작은 겹친 Avatar(sm 24, 지금 보이는 칸 기준: 연결이면 둘, 미합류·각자 계열 내 저금 칸이면 나).
 * 2026-11-18: 누를 수 없는 정보 상자(칸·‘모두 보기’ 이동 없음). 같이 모으기 항목이 하나도 없으면 홈이 이 상자를 그리지 않음
 * (빈 상태 질문·칩·버튼은 W-01 저축·투자 묶음 빈 상태로 옮김, 상대 권유는 띠 13번)
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

  const bundleSlide = (b: BundleViewResponse): Slide => {
    const done = b.status === 'achieved' || (b.pct !== null && b.pct >= 100);
    const lines: string[] = [];
    const say: string[] = [b.name];
    // 아직 안 들어간 묶음(상대가 만듦): 첫 줄에 권유, (2026-11-14 H1, 2026-11-18부터 상자는 누를 수 없어 들어가는 길은 묶음 알림·띠)
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
      say.push(won(total));
      // 보조 줄은 한 줄(2026-11-20): 목표 금액이 있으면 “10%, 300만 원 중”, 없으면 “이번 달 +30만 원”
      const g = b.month_gain ?? gain(b.goals.map((x) => x.id));
      if (b.target !== null && b.pct !== null) {
        lines.push(copy.pctOfTarget(b.pct, won(b.target)));
        say.push(copy.targetPctLabel(b.pct));
      } else if (g > 0) lines.push(copy.thisMonthGain(won(g)));
      const r = done
        ? null
        : savingRemain({ target: b.target, saved: total, deadline: b.deadline });
      if (r) say.push(copy.remain(r.deadline, won(r.remain)));
      if (b.show_each && b.mine !== null && b.partner !== null)
        lines.push(copy.each(names.me, won(b.mine), names.partner, won(b.partner)));
    }
    if (b.paused) lines.push(copy.paused);
    return {
      owners: people,
      art: art(b.name),
      name: b.name,
      amount: b.percent_only ? `${b.pct ?? 0}%` : won(b.total ?? 0),
      bar: b.target !== null || b.percent_only ? (b.pct ?? 0) : null,
      lines,
      done: done ? copy.doneBadge : undefined,
      paused: b.paused,
      percentOnly: b.percent_only,
      label: spoken(copy.togetherLabel(say)),
    };
  };

  const goalSlide = (g: Extract<HeroItem, { kind: 'goal' }>['goal']): Slide => {
    const saved = savedOf(g.id);
    const pct = savingPct(saved, g.target_amount);
    const lines: string[] = [];
    const say: string[] = [g.name, won(saved)];
    const solo = !joint && g.owner_user_id !== null;
    // 보조 줄은 한 줄(2026-11-20): 목표 금액이 있으면 “10%, 300만 원 중”, 없으면 “이번 달 +30만 원”.
    // “{이름}님은 아직 같이 모으기에 없어요”는 카드에서 없앰(띠 13번이 같은 권유를 함)
    if (g.target_amount !== null && pct !== null) {
      lines.push(copy.pctOfTarget(pct, won(g.target_amount)));
      say.push(copy.targetPctLabel(pct));
    } else {
      const m = gain([g.id]);
      if (m > 0) lines.push(copy.thisMonthGain(won(m)));
    }
    const r = savingRemain({ target: g.target_amount, saved, deadline: g.deadline });
    if (r) say.push(copy.remain(r.deadline, won(r.remain)));
    return {
      owners: solo ? (peopleMine ?? people) : people,
      art: art(g.name),
      name: g.name,
      amount: won(saved),
      bar: g.target_amount !== null ? savingBar(saved, g.target_amount) : null,
      lines,
      label: spoken(copy.togetherLabel(say)),
    };
  };

  return (
    <SaveTogether
      className="hg-hub__wide"
      title={copy.together}
      label={copy.together}
      head={head}
      slides={heroes.map((h) => (h.kind === 'bundle' ? bundleSlide(h.bundle) : goalSlide(h.goal)))}
    />
  );
}
