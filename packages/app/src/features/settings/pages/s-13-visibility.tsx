import { fetchAssets, qk, updateAsset, updateMe, type Asset } from '@sweetwo/api';
import { Button, ListRow, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

type Vis = 'all' | 'sum' | 'private';
const VIS: Vis[] = ['all', 'sum', 'private'];

function VisSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Vis;
  onChange: (v: Vis) => void;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="hg-sr">
        {label}
      </label>
      <select
        id={id}
        className="hg-input"
        value={value}
        onChange={(e) => onChange(e.target.value as Vis)}
      >
        {VIS.map((v) => (
          <option key={v} value={v}>
            {copy.vis[v]}
          </option>
        ))}
      </select>
    </>
  );
}

// S-13 공개 범위(docs/spec/25-settings.md, 08 4장): 새 항목 기본값(바꾸면 “이미 있는 항목 n개도 바꿀까요?”),
// 항상 함께 보는 것 3줄(보기만), 내 명의 항목마다 공개 범위(바로 반영). 다시 연결 뒤 한 번 확인할 때는 ?next=/ 로 열고 ‘확인’.
export function S13Visibility() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get('next');
  const d = useSettingsData();
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const [ask, setAsk] = useState<Vis | null>(null);
  const [busy, setBusy] = useState(false);
  if (d.loading || !d.me || assets.isLoading) return <MainFrame current={null} columns={[null]} />;
  const me = d.me;
  const mine = (assets.data ?? []).filter((a) => a.owner === 'person' && a.owner_user_id === me.id);
  const run = async (f: () => Promise<unknown>, keys: readonly (readonly string[])[]) => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
      await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
      toast(copy.saved);
    } catch {
      toast(copy.failed);
    } finally {
      setBusy(false);
    }
  };
  const setDefault = (v: Vis, all: boolean) =>
    run(async () => {
      await updateMe({ default_visibility: v });
      if (all)
        await Promise.all(
          mine.filter((a) => a.visibility !== v).map((a) => updateAsset(a.id, { visibility: v })),
        );
    }, [qk.me, qk.assets]);
  const differ = (v: Vis) => mine.filter((a) => a.visibility !== v).length;
  const label = (a: Asset) => (a.side === 'debt' ? `${a.name} ${copy.visDebt}` : a.name);

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.visTitle}
        backLabel={copy.back}
        backTo={next ? undefined : copy.title}
        onBack={() => nav(next ?? '/settings')}
      />
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.visDefault} />
        <p className="hg-q__help">{copy.visDefaultSub}</p>
        <VisSelect
          label={copy.visDefault}
          value={me.default_visibility}
          onChange={(v) => {
            if (v === me.default_visibility) return;
            if (differ(v) > 0) setAsk(v);
            else void setDefault(v, false);
          }}
        />
        {ask && (
          <div className="hg-stack" role="alertdialog" aria-label={copy.visApplyAll(differ(ask))}>
            <b>{copy.visApplyAll(differ(ask))}</b>
            <div className="hg-row" style={{ gap: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const v = ask;
                  setAsk(null);
                  void setDefault(v, true);
                }}
              >
                {copy.visAll}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const v = ask;
                  setAsk(null);
                  void setDefault(v, false);
                }}
              >
                {copy.visNewOnly}
              </Button>
            </div>
          </div>
        )}
      </section>
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.visFixedTitle} />
        <div className="hg-list">
          {copy.visFixed.map((t) => (
            <ListRow key={t} label={t} chevron={false} />
          ))}
        </div>
      </section>
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.visMine} />
        {mine.length === 0 ? (
          <p className="hg-q__help">{copy.visNone}</p>
        ) : (
          <div className="hg-stack" style={{ gap: 'var(--space-3)' }}>
            {mine.map((a) => (
              <div
                key={a.id}
                className="hg-row"
                style={{ gap: 'var(--space-3)', alignItems: 'center' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{label(a)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <VisSelect
                    label={copy.visLabel(a.name)}
                    value={a.visibility}
                    onChange={(v) =>
                      void run(() => updateAsset(a.id, { visibility: v }), [qk.assets])
                    }
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      {next && (
        <div className="hg-row">
          <Button variant="primary" onClick={() => nav(next, { replace: true })}>
            {copy.ok}
          </Button>
        </div>
      )}
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
