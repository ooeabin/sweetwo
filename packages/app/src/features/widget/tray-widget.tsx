import { formatKstDateTime, readWon, TrayState, type TraySnapshot } from '@sweetwo/core';
import { Button, Icon, Wordmark } from '@sweetwo/ui';
import { useEffect, useState } from 'react';
import { copy } from './copy';

/** 버튼 기본 모양 지우기(DS 위젯 줄 모양 그대로) */
const bare = {
  background: 'none',
  border: 0,
  padding: 0,
  color: 'inherit',
  font: 'inherit',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
} as const;

const maskedInApp = () => {
  try {
    return localStorage.getItem('sweetwo.masked') === '1';
  } catch {
    return false;
  }
};

/** 오전·오후 시각(‘오전 10:30 기준’) */
const clock = (iso: string) => {
  const t = formatKstDateTime(iso).slice(11, 16);
  const h = Number(t.slice(0, 2));
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${t.slice(3)}`;
};

// 트레이 위젯 창(26 트레이 위젯 창, 디자인 Widget 트레이): 이번 달(WG-01) → 다음 할 일 1개 → 다가오는 날 2줄 → 아래 업데이트 시각 + ‘앱 열기’.
// 진행 막대 없음. 값은 앱 창이 보낸 마지막 값(오프라인이면 그 시각 기준). 로그인 전·잠김이면 내용 없이 안내 + 앱 열기.
// 금액은 설정 S-22 ‘위젯에 금액 보이기’를 켜고 앱 금액 가리기가 꺼져 있을 때만. 누르면 앱 창이 앞으로 + 그 화면. Esc로 닫힘.
export function TrayWidget() {
  const bridge = typeof window !== 'undefined' ? window.sweetwo?.widget : undefined;
  const [st, setSt] = useState<TrayState | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!bridge) return;
    const take = (raw: unknown) => {
      const p = TrayState.safeParse(raw);
      if (p.success) setSt(p.data);
    };
    void bridge.state().then(take);
    const off = bridge.onChange(take);
    const t = setInterval(() => tick((x) => x + 1), 60_000);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && void bridge.hide();
    window.addEventListener('keydown', esc);
    return () => {
      off();
      clearInterval(t);
      window.removeEventListener('keydown', esc);
    };
  }, [bridge]);
  if (!bridge || !st) return null;
  const open = (path: string) => void bridge.open(path);

  if (!st.signedIn || st.locked)
    return (
      <div className="hg-wg-tray hg-wg-tray--locked">
        <p className="hg-wg__note">{st.signedIn ? copy.locked : copy.signedOut}</p>
        <Button variant="primary" block onClick={() => open('/')}>
          {copy.openApp}
        </Button>
      </div>
    );

  const s = st.snapshot;
  const masked = !st.settings.showAmounts || maskedInApp();
  return (
    <div className="hg-wg-tray" style={{ border: 0 }}>
      <div className="hg-wg-tray__head">
        <Wordmark height={24} />
      </div>
      {s ? <Sum s={s} masked={masked} open={open} /> : <p className="hg-wg__note">{copy.noPlan}</p>}
      {s?.task && (
        <button type="button" className="hg-wg-tray__task" onClick={() => open(s.task?.to ?? '/')}>
          <span>
            <span className="hg-wg__meta">{copy.task}</span>
            <br />
            {s.task.title}
          </span>
          <Icon name="chevron-right" />
        </button>
      )}
      {s && (
        <section className="hg-wg-tray__sec" aria-label={copy.days}>
          {s.days.length === 0 ? (
            <button type="button" className="hg-btn hg-btn--link" onClick={() => open('/calendar')}>
              {copy.noDays}
            </button>
          ) : (
            <div className="hg-wg-days">
              {s.days.slice(0, 2).map((d) => (
                <button
                  key={`${d.date}-${d.name}`}
                  type="button"
                  className={`hg-wg-day${d.money ? ' is-money' : ''}`}
                  style={bare}
                  onClick={() => open(d.to)}
                >
                  <span className="hg-wg-day__d">{copy.dday(d.dday)}</span>
                  <span className="hg-wg-day__mark" aria-hidden="true">
                    <span className="hg-cal__dot" />
                  </span>
                  <span className="hg-wg-day__name">{d.name}</span>
                  <span className="hg-wg-day__date">{d.date}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="hg-wg-tray__foot">
        <span className="hg-wg-tray__sync">
          {s
            ? typeof navigator !== 'undefined' && !navigator.onLine
              ? copy.basis(clock(s.at))
              : copy.updated(Math.floor((Date.now() - new Date(s.at).getTime()) / 60_000))
            : ''}
        </span>
        <Button variant="primary" size="sm" onClick={() => open('/')}>
          {copy.openApp}
        </Button>
      </div>
    </div>
  );
}

function Sum({ s, masked, open }: { s: TraySnapshot; masked: boolean; open: (p: string) => void }) {
  if (s.kind === 'no_plan')
    return (
      <button type="button" className="hg-wg-tray__sum hg-btn--link" onClick={() => open('/')}>
        <p className="hg-wg__note">{copy.noPlan}</p>
      </button>
    );
  const allDone = s.kind === 'split' && s.total > 0 && s.done === s.total;
  const label =
    s.kind === 'split'
      ? masked
        ? copy.splitMasked
        : copy.split
      : s.kind === 'gather'
        ? copy.gather
        : copy.living;
  let value: string;
  let note: string | null = null;
  if (allDone) value = copy.splitAllDone;
  else if (!masked) value = s.over ? copy.livingOver(readWon(s.amount)) : readWon(s.amount);
  else if (s.kind === 'split') {
    value = `${s.pct ?? 0}%`;
    note = copy.splitCount(s.total, s.done);
  } else if (s.kind === 'living' && s.pct !== null) value = copy.livingMasked(s.pct);
  else value = copy.hidden;
  const meta =
    s.closeDays !== null
      ? copy.close(s.closeDays)
      : s.payday !== null
        ? copy.payday(s.payday)
        : null;
  return (
    <button
      type="button"
      className="hg-wg-tray__sum"
      style={bare}
      onClick={() => open(s.to)}
      aria-label={`${label}, ${masked ? copy.hidden : value}${meta ? `, ${meta}` : ''}`}
    >
      <span className="hg-wg__label">
        {label}
        {masked && <Icon name="eye-off" className="hg-wg__hidden" />}
      </span>
      <span className="hg-wg__value">{value}</span>
      {note && <span className="hg-wg__note">{note}</span>}
      {meta && <span className="hg-wg__meta">{meta}</span>}
    </button>
  );
}
