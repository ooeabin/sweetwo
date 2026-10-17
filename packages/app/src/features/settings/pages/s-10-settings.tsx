import { notiPrefs } from '@sweetwo/core';
import { ListRow } from '@sweetwo/ui';
import { useNavigate } from 'react-router-dom';
import { detectPlatform } from '../../../platform';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useSettingsData } from '../data';

// S-10 설정 홈(docs/spec/25-settings.md). 메뉴가 아니라 상단 아바타(좁은 창은 설정 버튼)로 들어옴.
// 지금 있는 화면: 내 정보(S-11), 알림(S-14). 나머지 줄은 자리만(누르지 않음, “준비 중이에요”).
// 공개 범위 줄은 배우자 미합류·혼자 쓰기면 숨김, 위젯 줄은 데스크톱만.
export function S10Settings() {
  const nav = useNavigate();
  const d = useSettingsData();
  if (d.loading || !d.me || !d.c) return <MainFrame current={null} columns={[null]} />;
  const desktop = detectPlatform() === 'desktop';
  const c = d.c;
  const state = d.space?.couple_state ?? 'not_joined';
  const prefs = notiPrefs(d.me.noti_prefs);
  const later = copy.later;
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <div className="hg-list">
        <ListRow
          lead={
            <span className="hg-avatars" aria-hidden="true">
              <span className={c.starter ? 'hg-avatar hg-avatar--p1' : 'hg-avatar hg-avatar--p2'}>
                {[...c.myName][0] ?? ''}
              </span>
              {c.partnerName && !c.solo && (
                <span className={c.starter ? 'hg-avatar hg-avatar--p2' : 'hg-avatar hg-avatar--p1'}>
                  {[...c.partnerName][0] ?? ''}
                </span>
              )}
            </span>
          }
          label={copy.couple(c.myName, c.solo ? '' : c.partnerName)}
          sub={copy.loggedIn(copy.providers[d.me.provider ?? ''] ?? '')}
          onClick={() => nav('/settings/me')}
        />
        <ListRow
          label={copy.rows.couple}
          value={state === 'connected' ? copy.state.connected(c.partnerName) : copy.state[state]}
          sub={later}
        />
      </div>
      <div className="hg-list">
        {c.joined && (
          <ListRow label={copy.rows.visibility} value={copy.rows.visibilityValue} sub={later} />
        )}
        <ListRow
          label={copy.rows.noti}
          value={copy.channelsOn(
            [desktop && prefs.push ? copy.push : null, prefs.email ? copy.email : null].filter(
              (x): x is string => !!x,
            ),
          )}
          onClick={() => nav('/settings/notifications')}
        />
        <ListRow label={copy.rows.security} sub={later} />
        <ListRow label={copy.rows.answers} sub={later} />
        <ListRow label={copy.rows.guide} sub={later} />
        <ListRow label={copy.rows.screen} value={copy.rows.screenValue} />
      </div>
      <div className="hg-list">
        <ListRow label={copy.rows.help} sub={later} />
        <ListRow label={copy.rows.data} sub={copy.rows.dataSub} />
        <ListRow
          label={copy.rows.about}
          value={desktop ? (window.sweetwo?.appVersion ?? '') : undefined}
          sub={later}
        />
        {desktop && <ListRow label={copy.rows.widget} sub={copy.rows.widgetSub} />}
      </div>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
