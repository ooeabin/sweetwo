import {
  AdminError,
  adminEndNotice,
  adminRequestNotice,
  adminSaveNotice,
  adminSetNoticeEmail,
  adminSetNoticeTarget,
  adminTestNoticeMail,
  fetchAdminNotices,
  fetchNoticeAudience,
  type Notice,
} from '@sweetwo/api';
import {
  formatKstDateTime,
  NOTICE_COUPLE_STATES,
  NOTICE_VERSION,
  NoticeTarget,
} from '@sweetwo/core';
import { Button, Chip, DataTable, Icon, Status, Toggle } from '@sweetwo/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy, ops } from '../copy';
import { noticeTone } from '../tones';
import { Frame } from '../frame';
import { useAdmin } from '../gate';

// 웹 앱은 없다(ADR 0001). 예전 공지의 'web'은 고칠 때 빠진다.
type Platform = 'desktop' | 'mobile';
const PLATFORMS: readonly Platform[] = ['desktop', 'mobile'];
type CoupleState = (typeof NOTICE_COUPLE_STATES)[number];
const KINDS = ['info', 'maintenance', 'incident', 'terms'];
// datetime-local(KST로 넣음) ↔ ISO
const toIso = (local: string) => (local ? new Date(`${local}:00+09:00`).toISOString() : '');

// AD-10 공지(MVP: 앱 안 공지 + 약관 개정·1등급 장애 고지 메일). 노출 기간·중요도(일반/필독)·대상 플랫폼 + 대상 조건
// (커플 상태, 앱 버전, 가입 주차. 금액 조건 없음). 약관 개정은 조건 없이 모든 회원.
// 대상 수는 조건을 바꿀 때마다 서버가 다시 셈(숫자만), 0명이면 승인 요청 불가. 미리보기는 홈 상단 띠 + 메일.
// 테스트 발송은 메일 공지만, 내 관리자 메일로만. 저장은 초안, 게시는 승인 요청 → 최고 관리자 승인(본인도 가능). 운영이나 최고 관리자가 작성.
// 밤 10시~아침 8시 시작은 저장 불가. 메일은 게시 + 노출 시작 때 한 번(상한 밖, 서버 send_notice_mails):
// 약관 개정은 모든 회원, 장애 고지는 대상 조건에 맞는 회원(33 ‘1등급 장애 뒤 고지’ 영향받은 커플).
export function AD10Notices() {
  const me = useAdmin();
  const canEdit = me.roles.includes('ops') || me.roles.includes('super');
  const list = useQuery({ queryKey: ['admin', 'notices'], queryFn: fetchAdminNotices });
  const [edit, setEdit] = useState<Notice | 'new' | null>(null);
  return (
    <Frame
      menu="send"
      title={ops.noticeTitle}
      actions={
        canEdit && (
          <Button variant="primary" size="sm" onClick={() => setEdit('new')}>
            {ops.newNotice}
          </Button>
        )
      }
    >
      <div className="hg-admin__grid">
        <div className="hg-admin__col">
          <DataTable<Notice>
            label={ops.noticeTitle}
            rows={list.data ?? []}
            rowKey={(n) => n.id}
            onRow={canEdit ? (n) => setEdit(n) : undefined}
            empty={list.isLoading ? null : ops.noticeEmpty}
            columns={[
              { key: 'title', label: ops.noticeCols.title, render: (n) => n.title },
              { key: 'kind', label: ops.noticeCols.kind, render: (n) => ops.noticeKinds[n.kind] },
              {
                key: 'imp',
                label: ops.noticeCols.importance,
                render: (n) => ops.importance[n.importance],
              },
              {
                key: 'period',
                label: ops.noticeCols.period,
                render: (n) =>
                  `${formatKstDateTime(n.starts_at)} ~ ${formatKstDateTime(n.ends_at)}`,
              },
              {
                key: 'status',
                label: ops.noticeCols.status,
                render: (n) => (
                  <Status tone={noticeTone[n.status] ?? 'off'}>{ops.noticeStatus[n.status]}</Status>
                ),
              },
            ]}
          />
        </div>
        <div className="hg-admin__col">
          {edit && (
            <NoticeForm
              key={edit === 'new' ? 'new' : edit.id}
              n={edit === 'new' ? null : edit}
              onDone={() => {
                setEdit(null);
                void list.refetch();
              }}
            />
          )}
        </div>
      </div>
    </Frame>
  );
}

const local = (iso: string | undefined) => (iso ? formatKstDateTime(iso).replace(' ', 'T') : '');
const weekNum = (s: string) => (s.trim() === '' ? undefined : Number(s));

function NoticeForm({ n, onDone }: { n: Notice | null; onDone: () => void }) {
  const draft = !n || n.status === 'draft';
  const saved = NoticeTarget.safeParse(n?.target ?? {});
  const t0 = saved.success ? saved.data : {};
  const [kind, setKind] = useState(n?.kind ?? 'info');
  const [title, setTitle] = useState(n?.title ?? '');
  const [body, setBody] = useState(n?.body ?? '');
  const [importance, setImportance] = useState<'normal' | 'must'>(
    (n?.importance as 'normal' | 'must' | undefined) ?? 'normal',
  );
  const [platforms, setPlatforms] = useState<Platform[]>(
    n?.platforms ? PLATFORMS.filter((p) => n.platforms.includes(p)) : [...PLATFORMS],
  );
  const [couples, setCouples] = useState<CoupleState[]>(t0.couple_states ?? []);
  const [version, setVersion] = useState(t0.version_below ?? '');
  const [weeksMin, setWeeksMin] = useState(t0.weeks_min?.toString() ?? '');
  const [weeksMax, setWeeksMax] = useState(t0.weeks_max?.toString() ?? '');
  const [starts, setStarts] = useState(local(n?.starts_at));
  const [ends, setEnds] = useState(local(n?.ends_at));
  const [email, setEmail] = useState(n?.email ?? false);
  const mailable = kind === 'terms' || kind === 'incident';
  const mail = mailable && email;
  const terms = kind === 'terms';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 대상 조건: 약관 개정은 빈 조건(모든 회원)
  const versionOk = version.trim() === '' || NOTICE_VERSION.test(version.trim());
  const built = NoticeTarget.safeParse(
    terms
      ? {}
      : {
          ...(couples.length ? { couple_states: couples } : {}),
          ...(version.trim() ? { version_below: version.trim() } : {}),
          ...(weekNum(weeksMin) !== undefined ? { weeks_min: weekNum(weeksMin) } : {}),
          ...(weekNum(weeksMax) !== undefined ? { weeks_max: weekNum(weeksMax) } : {}),
        },
  );
  const weeksOk = terms || !versionOk || built.success;
  const target = built.success ? built.data : null;

  // 27 AD-10 4번: 조건 바꿀 때마다 다시 셈
  const audience = useQuery({
    queryKey: ['admin', 'notice-audience', kind, platforms, target, mail],
    queryFn: () => fetchNoticeAudience({ kind, platforms, target: target ?? {}, email: mail }),
    enabled: !!target && platforms.length > 0,
    placeholderData: keepPreviousData,
  });
  const zero = audience.data?.target === 0;

  const ready =
    !!title.trim() && !!starts && !!ends && ends > starts && platforms.length > 0 && !!target;
  const save = async (request: boolean) => {
    if (!target) return;
    setBusy(true);
    setMsg(null);
    try {
      const id = await adminSaveNotice({
        id: n?.id ?? null,
        kind,
        title,
        body,
        importance,
        platforms,
        startsAt: toIso(starts),
        endsAt: toIso(ends),
        request: false,
      });
      if (mailable || n?.email) await adminSetNoticeEmail(id, mail);
      if (Object.keys(target).length || Object.keys(t0).length)
        await adminSetNoticeTarget(id, target);
      if (request) await adminRequestNotice(id);
      setMsg(request ? ops.requestedApproval : ops.saved);
      onDone();
    } catch (e) {
      const code = e instanceof AdminError ? e.code : '';
      setMsg(
        code === 'quiet_hours'
          ? ops.quietHours
          : code === 'no_audience'
            ? ops.audience.zero
            : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await adminTestNoticeMail({ kind, title, body });
      setMsg(ops.testSent);
    } catch (e) {
      setMsg(e instanceof AdminError && e.code === 'too_many' ? ops.testTooMany : copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (p: Platform) =>
    setPlatforms((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  const toggleCouple = (c: CoupleState) =>
    setCouples((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  return (
    <>
      <section className="hg-card hg-stack" aria-label={n ? n.title : ops.newNotice}>
        <label className="hg-field">
          <span className="hg-field__label">{ops.field.kind}</span>
          <select
            className="hg-input"
            value={kind}
            disabled={!draft}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {ops.noticeKinds[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="hg-field">
          <span className="hg-field__label">{ops.field.title}</span>
          <input
            className="hg-input"
            value={title}
            maxLength={60}
            disabled={!draft}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="hg-field">
          <span className="hg-field__label">{ops.field.body}</span>
          <textarea
            className="hg-input"
            rows={4}
            value={body}
            maxLength={2000}
            disabled={!draft}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        {mailable && (
          <Toggle
            label={ops.field.email}
            help={terms ? ops.field.emailHelp : ops.field.emailHelpTarget}
            checked={email}
            disabled={!draft}
            onChange={setEmail}
          />
        )}
        <div
          className="hg-row"
          style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
          role="group"
          aria-label={ops.field.importance}
        >
          {(['normal', 'must'] as const).map((i) => (
            <Chip
              key={i}
              small
              selected={importance === i}
              disabled={!draft}
              onClick={() => setImportance(i)}
            >
              {ops.importance[i]}
            </Chip>
          ))}
        </div>
        <div
          className="hg-row"
          style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
          role="group"
          aria-label={ops.field.platforms}
        >
          {PLATFORMS.map((p) => (
            <Chip
              key={p}
              small
              selected={platforms.includes(p)}
              disabled={!draft}
              onClick={() => toggle(p)}
            >
              {ops.platforms[p]}
            </Chip>
          ))}
        </div>
        <label className="hg-field">
          <span className="hg-field__label">{ops.field.starts}</span>
          <input
            className="hg-input"
            type="datetime-local"
            value={starts}
            disabled={!draft}
            onChange={(e) => setStarts(e.target.value)}
          />
        </label>
        <label className="hg-field">
          <span className="hg-field__label">{ops.field.ends}</span>
          <input
            className="hg-input"
            type="datetime-local"
            value={ends}
            disabled={!draft}
            onChange={(e) => setEnds(e.target.value)}
          />
        </label>
        {msg && (
          <p className="hg-help" role="status">
            {msg}
          </p>
        )}
        {draft ? (
          <div className="hg-row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" disabled={!ready || busy} onClick={() => void save(false)}>
              {ops.saveDraft}
            </Button>
            {mail && (
              <Button
                variant="secondary"
                disabled={!title.trim() || busy}
                title={ops.testHelp}
                onClick={() => void test()}
              >
                {ops.testSend}
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!ready || busy || zero || audience.isFetching}
              onClick={() => void save(true)}
            >
              {ops.requestApproval}
            </Button>
          </div>
        ) : (
          n?.status === 'published' && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => n && void adminEndNotice(n.id).then(onDone)}
            >
              {ops.endNotice}
            </Button>
          )
        )}
        {draft && mail && <p className="hg-help">{ops.testHelp}</p>}
      </section>

      <section className="hg-card hg-stack" aria-label={ops.target.title}>
        <span className="hg-card__label">{ops.target.title}</span>
        {terms ? (
          <p className="hg-help">{ops.target.all}</p>
        ) : (
          <>
            <div className="hg-field">
              <span className="hg-field__label" id="notice-couple">
                {ops.target.coupleStates}
              </span>
              <div
                className="hg-row"
                style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
                role="group"
                aria-labelledby="notice-couple"
              >
                {NOTICE_COUPLE_STATES.map((c) => (
                  <Chip
                    key={c}
                    small
                    selected={couples.includes(c)}
                    disabled={!draft}
                    onClick={() => toggleCouple(c)}
                  >
                    {copy.coupleStates[c]}
                  </Chip>
                ))}
              </div>
              <span className="hg-help">{ops.target.coupleHelp}</span>
            </div>
            <label className="hg-field">
              <span className="hg-field__label">{ops.target.versionBelow}</span>
              <input
                className="hg-input"
                value={version}
                inputMode="decimal"
                maxLength={14}
                disabled={!draft}
                aria-invalid={!versionOk}
                onChange={(e) => setVersion(e.target.value)}
              />
              <span className={versionOk ? 'hg-help' : 'hg-help is-error'}>
                {versionOk ? ops.target.versionHelp : ops.target.badVersion}
              </span>
            </label>
            <div className="hg-admin__grid2">
              <label className="hg-field">
                <span className="hg-field__label">{ops.target.weeksMin}</span>
                <input
                  className="hg-input"
                  type="number"
                  min={1}
                  max={520}
                  value={weeksMin}
                  disabled={!draft}
                  aria-invalid={!weeksOk}
                  onChange={(e) => setWeeksMin(e.target.value)}
                />
              </label>
              <label className="hg-field">
                <span className="hg-field__label">{ops.target.weeksMax}</span>
                <input
                  className="hg-input"
                  type="number"
                  min={1}
                  max={520}
                  value={weeksMax}
                  disabled={!draft}
                  aria-invalid={!weeksOk}
                  onChange={(e) => setWeeksMax(e.target.value)}
                />
              </label>
            </div>
            <span className={weeksOk ? 'hg-help' : 'hg-help is-error'}>
              {weeksOk ? ops.target.weeksHelp : ops.target.badWeeks}
            </span>
          </>
        )}
        <div
          className="hg-admin__grid2"
          role="group"
          aria-live="polite"
          aria-label={ops.audience.title}
        >
          <div className="hg-admin__stat">
            <span>{ops.audience.target}</span>
            <b>{audience.data ? ops.audience.people(audience.data.target) : '—'}</b>
          </div>
          <div className="hg-admin__stat">
            <span>{ops.audience.excluded}</span>
            <b>{audience.data ? ops.audience.people(audience.data.excluded) : '—'}</b>
          </div>
        </div>
        {mail && audience.data && (
          <div className="hg-admin__kv">
            <span>{ops.audience.blocked}</span>
            <span>{ops.audience.people(audience.data.blocked)}</span>
          </div>
        )}
        {audience.isError && <p className="hg-help is-error">{ops.audience.failed}</p>}
        {zero && <p className="hg-help">{ops.audience.zero}</p>}
      </section>

      <NoticePreview title={title} body={body} importance={importance} mail={mail} />
    </>
  );
}

// 27 AD-10 6번 미리보기: 앱 홈 상단 공지 띠(packages/app NoticeBand와 같은 hg-banner--line 모양, 접힌 것·펼친 것) + 메일
function NoticePreview({
  title,
  body,
  importance,
  mail,
}: {
  title: string;
  body: string;
  importance: 'normal' | 'must';
  mail: boolean;
}) {
  const t = title.trim() || ops.preview.emptyTitle;
  const band = (open: boolean) => (
    <div className="hg-banner hg-banner--line" aria-hidden="true">
      <Icon name="info" size={16} />
      <span className="hg-stack" style={{ gap: 'var(--space-1)' }}>
        <strong className={open ? undefined : 'hg-banner__one'}>{t}</strong>
        {open && body && <span style={{ whiteSpace: 'pre-wrap' }}>{body}</span>}
      </span>
      {body && (
        <Button variant="secondary" size="sm" tabIndex={-1}>
          {open ? ops.preview.fold : ops.preview.open}
        </Button>
      )}
      {importance !== 'must' && (
        <Button variant="ghost" size="sm" tabIndex={-1}>
          {ops.preview.close}
        </Button>
      )}
    </div>
  );
  return (
    <section className="hg-card hg-stack" aria-label={ops.preview.title}>
      <span className="hg-card__label">{ops.preview.title}</span>
      <span className="hg-card__meta">{ops.preview.band}</span>
      {band(false)}
      {body && band(true)}
      {mail && (
        <>
          <span className="hg-card__meta">{ops.preview.mail}</span>
          <div className="hg-card hg-stack">
            <span className="hg-card__meta">{ops.preview.from}</span>
            <strong>{t}</strong>
            {body && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{body}</p>}
            <span className="hg-help">{ops.preview.sign}</span>
          </div>
        </>
      )}
    </section>
  );
}
