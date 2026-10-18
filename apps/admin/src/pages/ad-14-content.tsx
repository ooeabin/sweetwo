import {
  AdminError,
  adminAddContentVersion,
  adminAddTermsVersion,
  adminSetHoliday,
  adminSetLoanRate,
  fetchContentVersions,
  fetchHolidays,
  fetchLoanRates,
  fetchTermsVersions,
  type ContentVersion,
  type LoanRate,
  type TermsVersionRow,
} from '@sweetwo/api';
import { addDays, daysBetween, todayKst } from '@sweetwo/core';
import { Badge, Button, DataTable, Tabs } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { copy, ops } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';

type Tab = 'guides' | 'terms' | 'data';

// 콘텐츠: AD-14 가이드·도움말 버전(본문은 저장소 마크다운, 확인일 6개월 지나면 재검토), AD-15 약관·처리방침 버전
// (법률 검토 체크 없으면 승인 요청 불가, 버전별 동의 수), AD-19 계산·기준 데이터(대출 평균 금리, 공휴일).
// 운영이 쓰고, 약관 버전은 최고 관리자 승인.
export function AD14Content() {
  const me = useAdmin();
  const canEdit = me.roles.includes('ops');
  const [tab, setTab] = useState<Tab>('guides');
  return (
    <Frame menu="content" title={ops.contentTitle}>
      <Tabs<Tab>
        label={ops.contentTitle}
        items={(Object.keys(ops.tabs) as Tab[]).map((t) => ({ value: t, label: ops.tabs[t] }))}
        value={tab}
        onChange={setTab}
      />
      {tab === 'guides' && <Guides canEdit={canEdit} />}
      {tab === 'terms' && <Terms canEdit={canEdit} />}
      {tab === 'data' && <RefData canEdit={canEdit} />}
    </Frame>
  );
}

function Guides({ canEdit }: { canEdit: boolean }) {
  const q = useQuery({ queryKey: ['admin', 'content-versions'], queryFn: fetchContentVersions });
  const today = todayKst();
  const [f, setF] = useState({
    kind: 'faq',
    key: '',
    version: '',
    effective: today,
    checked: today,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const add = async () => {
    setMsg(null);
    try {
      await adminAddContentVersion({
        ...f,
        kind: f.kind as 'guide' | 'checklist' | 'faq',
        note: '',
      });
      setF({ ...f, key: '', version: '' });
      void q.refetch();
    } catch {
      setMsg(copy.failed);
    }
  };
  return (
    <div className="hg-admin__grid">
      <DataTable<ContentVersion>
        label={ops.tabs.guides}
        rows={q.data ?? []}
        rowKey={(r) => r.id}
        columns={[
          { key: 'kind', label: ops.versionCols.kind, render: (r) => ops.guideKinds[r.kind] },
          { key: 'key', label: ops.versionCols.key, render: (r) => r.key },
          { key: 'v', label: ops.versionCols.version, render: (r) => r.version },
          { key: 'eff', label: ops.versionCols.effective, render: (r) => r.effective_on },
          {
            key: 'chk',
            label: ops.versionCols.checked,
            render: (r) => (
              <>
                {r.checked_on}{' '}
                {daysBetween(r.checked_on, today) > 183 && <Badge kind="warn">{ops.recheck}</Badge>}
              </>
            ),
          },
        ]}
      />
      {canEdit && (
        <section className="hg-card hg-stack" aria-label={ops.addVersion}>
          <span className="hg-card__label">{ops.addVersion}</span>
          <label className="hg-field">
            <span className="hg-field__label">{ops.versionCols.kind}</span>
            <select
              className="hg-input"
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value })}
            >
              {Object.entries(ops.guideKinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <Input
            label={ops.versionCols.key}
            value={f.key}
            onChange={(v) => setF({ ...f, key: v })}
          />
          <Input
            label={ops.versionCols.version}
            value={f.version}
            onChange={(v) => setF({ ...f, version: v })}
          />
          <Input
            label={ops.versionCols.effective}
            type="date"
            value={f.effective}
            onChange={(v) => setF({ ...f, effective: v })}
          />
          <Input
            label={ops.versionCols.checked}
            type="date"
            value={f.checked}
            onChange={(v) => setF({ ...f, checked: v })}
          />
          {msg && <p className="hg-help is-error">{msg}</p>}
          <Button variant="primary" disabled={!f.key || !f.version} onClick={() => void add()}>
            {ops.addVersion}
          </Button>
        </section>
      )}
    </div>
  );
}

function Terms({ canEdit }: { canEdit: boolean }) {
  const q = useQuery({ queryKey: ['admin', 'terms-versions'], queryFn: fetchTermsVersions });
  const [f, setF] = useState({
    kind: 'terms',
    version: '',
    effective: addDays(todayKst(), 30),
    reconsent: false,
    legal: false,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const add = async () => {
    setMsg(null);
    try {
      await adminAddTermsVersion({
        kind: f.kind as 'terms' | 'privacy',
        version: f.version,
        effective: f.effective,
        reconsent: f.reconsent,
        legalChecked: f.legal,
      });
      setMsg(ops.requestedApproval);
      void q.refetch();
    } catch (e) {
      setMsg(
        e instanceof AdminError && e.code === 'legal_check_required'
          ? ops.legalChecked
          : copy.failed,
      );
    }
  };
  return (
    <div className="hg-admin__grid">
      <DataTable<TermsVersionRow>
        label={ops.tabs.terms}
        rows={q.data ?? []}
        rowKey={(r) => r.id}
        columns={[
          { key: 'kind', label: ops.termsCols.kind, render: (r) => ops.termsKinds[r.kind] },
          { key: 'v', label: ops.termsCols.version, render: (r) => r.version },
          { key: 'eff', label: ops.termsCols.effective, render: (r) => r.effective_on },
          {
            key: 're',
            label: ops.termsCols.reconsent,
            render: (r) => (r.reconsent ? ops.yes : ops.no),
          },
          {
            key: 'n',
            label: ops.termsCols.agreed,
            num: true,
            render: (r) => r.agreed.toLocaleString('ko-KR'),
          },
          { key: 's', label: ops.termsCols.status, render: (r) => ops.termsStatus[r.status] },
        ]}
      />
      {canEdit && (
        <section className="hg-card hg-stack" aria-label={ops.addVersion}>
          <span className="hg-card__label">{ops.addVersion}</span>
          <label className="hg-field">
            <span className="hg-field__label">{ops.termsCols.kind}</span>
            <select
              className="hg-input"
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value })}
            >
              {Object.entries(ops.termsKinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <Input
            label={ops.termsCols.version}
            value={f.version}
            onChange={(v) => setF({ ...f, version: v })}
          />
          <Input
            label={ops.termsCols.effective}
            type="date"
            value={f.effective}
            onChange={(v) => setF({ ...f, effective: v })}
          />
          <label className="hg-row" style={{ gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              checked={f.reconsent}
              onChange={(e) => setF({ ...f, reconsent: e.target.checked })}
            />
            {ops.reconsent}
          </label>
          <label className="hg-row" style={{ gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              checked={f.legal}
              onChange={(e) => setF({ ...f, legal: e.target.checked })}
            />
            {ops.legalChecked}
          </label>
          {msg && (
            <p className="hg-help" role="status">
              {msg}
            </p>
          )}
          <Button variant="primary" disabled={!f.version || !f.legal} onClick={() => void add()}>
            {ops.requestApproval}
          </Button>
        </section>
      )}
    </div>
  );
}

function RefData({ canEdit }: { canEdit: boolean }) {
  const rates = useQuery({ queryKey: ['admin', 'loan-rates'], queryFn: fetchLoanRates });
  const hol = useQuery({ queryKey: ['admin', 'holidays'], queryFn: fetchHolidays });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [h, setH] = useState({
    date: '',
    name: '',
    kind: 'temporary' as 'holiday' | 'substitute' | 'temporary',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const saveRate = async (r: LoanRate) => {
    const v = Math.round(Number(edit[r.kind]) * 100);
    if (!Number.isFinite(v)) return;
    try {
      await adminSetLoanRate(r.kind, v, todayKst());
      setEdit((x) => ({ ...x, [r.kind]: '' }));
      void rates.refetch();
    } catch {
      setMsg(copy.failed);
    }
  };
  const pct = (bp: number) => `${Math.floor(bp / 100)}.${String(bp % 100).padStart(2, '0')}%`;
  return (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <DataTable<LoanRate>
        label={ops.loanTitle}
        rows={rates.data ?? []}
        rowKey={(r) => r.kind}
        columns={[
          { key: 'kind', label: ops.loanCols.kind, render: (r) => ops.loanKinds[r.kind] },
          {
            key: 'rate',
            label: ops.loanCols.rate,
            num: true,
            render: (r) =>
              canEdit ? (
                <span
                  className="hg-row"
                  style={{ gap: 'var(--space-2)', justifyContent: 'flex-end' }}
                >
                  <input
                    className="hg-input"
                    style={{ width: 96 }}
                    inputMode="decimal"
                    aria-label={`${ops.loanKinds[r.kind]} ${ops.loanCols.rate}`}
                    placeholder={pct(r.rate_bp)}
                    value={edit[r.kind] ?? ''}
                    onChange={(e) => setEdit((x) => ({ ...x, [r.kind]: e.target.value }))}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!edit[r.kind]}
                    onClick={() => void saveRate(r)}
                  >
                    {ops.save}
                  </Button>
                </span>
              ) : (
                pct(r.rate_bp)
              ),
          },
          { key: 'applied', label: ops.loanCols.applied, render: (r) => r.applied_on },
        ]}
      />
      <div className="hg-admin__grid">
        <DataTable
          label={ops.holidayTitle}
          rows={(hol.data ?? []).filter((x) => x.date >= todayKst())}
          rowKey={(x) => x.date}
          columns={[
            { key: 'date', label: ops.date, render: (x) => x.date },
            { key: 'name', label: ops.name, render: (x) => x.name },
            {
              key: 'kind',
              label: ops.versionCols.kind,
              render: (x) => ops.holidayKinds[x.kind] ?? x.kind,
            },
            {
              key: 'del',
              label: '',
              render: (x) =>
                canEdit && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() =>
                      void adminSetHoliday(x.date, x.name, x.kind as 'holiday', true).then(() =>
                        hol.refetch(),
                      )
                    }
                  >
                    {ops.remove}
                  </Button>
                ),
            },
          ]}
        />
        {canEdit && (
          <section className="hg-card hg-stack" aria-label={ops.holidayTitle}>
            <Input
              label={ops.date}
              type="date"
              value={h.date}
              onChange={(v) => setH({ ...h, date: v })}
            />
            <Input label={ops.name} value={h.name} onChange={(v) => setH({ ...h, name: v })} />
            <label className="hg-field">
              <span className="hg-field__label">{ops.versionCols.kind}</span>
              <select
                className="hg-input"
                value={h.kind}
                onChange={(e) => setH({ ...h, kind: e.target.value as typeof h.kind })}
              >
                {Object.entries(ops.holidayKinds).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {msg && <p className="hg-help is-error">{msg}</p>}
            <Button
              variant="primary"
              disabled={!h.date || !h.name.trim()}
              onClick={() =>
                void adminSetHoliday(h.date, h.name, h.kind).then(
                  () => hol.refetch(),
                  () => setMsg(copy.failed),
                )
              }
            >
              {ops.save}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="hg-field">
      <span className="hg-field__label">{label}</span>
      <input
        className="hg-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
