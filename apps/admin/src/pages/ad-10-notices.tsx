import {
  AdminError,
  adminEndNotice,
  adminSaveNotice,
  fetchAdminNotices,
  type Notice,
} from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { Button, Chip, DataTable } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy, ops } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';

type Platform = 'desktop' | 'mobile' | 'web';
const KINDS = ['info', 'maintenance', 'incident', 'terms'];
// datetime-local(KST로 넣음) ↔ ISO
const toIso = (local: string) => (local ? new Date(`${local}:00+09:00`).toISOString() : '');

// AD-10 공지(MVP: 앱 안 공지). 노출 기간·중요도(일반/필독)·대상 플랫폼. 저장은 초안, 게시는 승인 요청 → 최고 관리자 승인.
// 밤 10시~아침 8시 시작은 저장 불가. 약관 개정·장애 고지 메일 발송은 메일 발송(SES) 연결 뒤.
export function AD10Notices() {
  const me = useAdmin();
  const canEdit = me.roles.includes('ops');
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
            empty={list.isLoading ? null : '—'}
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
                render: (n) => ops.noticeStatus[n.status],
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

function NoticeForm({ n, onDone }: { n: Notice | null; onDone: () => void }) {
  const draft = !n || n.status === 'draft';
  const [kind, setKind] = useState(n?.kind ?? 'info');
  const [title, setTitle] = useState(n?.title ?? '');
  const [body, setBody] = useState(n?.body ?? '');
  const [importance, setImportance] = useState<'normal' | 'must'>(
    (n?.importance as 'normal' | 'must' | undefined) ?? 'normal',
  );
  const [platforms, setPlatforms] = useState<Platform[]>(
    (n?.platforms as Platform[] | undefined) ?? ['desktop', 'mobile'],
  );
  const [starts, setStarts] = useState(local(n?.starts_at));
  const [ends, setEnds] = useState(local(n?.ends_at));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ready = !!title.trim() && !!starts && !!ends && ends > starts && platforms.length > 0;
  const save = async (request: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      await adminSaveNotice({
        id: n?.id ?? null,
        kind,
        title,
        body,
        importance,
        platforms,
        startsAt: toIso(starts),
        endsAt: toIso(ends),
        request,
      });
      setMsg(request ? ops.requestedApproval : ops.saved);
      onDone();
    } catch (e) {
      setMsg(e instanceof AdminError && e.code === 'quiet_hours' ? ops.quietHours : copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (p: Platform) =>
    setPlatforms((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  return (
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
        {(['desktop', 'mobile', 'web'] as const).map((p) => (
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
        <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
          <Button variant="secondary" disabled={!ready || busy} onClick={() => void save(false)}>
            {ops.saveDraft}
          </Button>
          <Button variant="primary" disabled={!ready || busy} onClick={() => void save(true)}>
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
    </section>
  );
}
