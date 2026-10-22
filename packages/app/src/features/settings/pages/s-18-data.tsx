import { fetchExportData, fetchTrash, qk, updateMe } from '@sweetwo/api';
import { makeZip, todayKst } from '@sweetwo/core';
import {
  Button,
  ChoiceCards,
  Field,
  ListRow,
  PageHeader,
  SectionHeader,
  Toggle,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../../shared/toast';
import { reauthenticate, session } from '../../auth';
import { MainFrame } from '../../month';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { buildExport, type Scope } from '../export';

/** 브라우저(웹)·Electron 공통: 내려받기(저장 위치는 브라우저·OS가 고르게 함) */
function saveFile(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// S-18 데이터(docs/spec/25-settings.md): 내보내기(내 데이터 / 공동 데이터, 엑셀 CSV zip, 본인 확인 뒤),
// 휴지통(→ S-21, 개수), 사용 기록 보내기 토글, 계정 삭제(→ S-18b).
// 본인 확인: 데스크톱은 PIN(있으면), 웹은 가입 소셜로 다시 로그인 → 돌아오면 이어서 내보냄(?export=범위).
// PDF 요약 3종은 다음 단계.
export function S18Data() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const d = useSettingsData();
  const trash = useQuery({ queryKey: qk.trash, queryFn: fetchTrash });
  const [scope, setScope] = useState<Scope>((params.get('export') as Scope | null) ?? 'joint');
  const [state, setState] = useState<'idle' | 'pin' | 'busy' | 'failed'>('idle');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const auto = useRef(false);

  const run = async (s: Scope) => {
    if (!d.me || !d.c) return;
    setState('busy');
    try {
      const data = await fetchExportData();
      const files = buildExport(data, s, {
        myId: d.me.id,
        myName: d.c.myName,
        partnerName: d.c.partnerName,
        starter: d.c.starter,
        mySide: d.me.side === 'groom' || d.me.side === 'bride' ? d.me.side : null,
      });
      saveFile(copy.fileName(s, todayKst().replace(/-/g, '')), makeZip(files));
      setState('idle');
      toast(copy.exported);
    } catch {
      setState('failed');
    }
  };

  // 웹: 다시 로그인하고 돌아오면 이어서 내보냄
  useEffect(() => {
    const s = params.get('export') as Scope | null;
    if (!s || auto.current || !d.me || !d.c) return;
    auto.current = true;
    void run(s).then(() => setParams({}, { replace: true }));
  }, [d.me, d.c]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading || !d.me || !d.c) return <MainFrame current={null} columns={[null]} />;
  const me = d.me;

  const start = async () => {
    const bridge = session.bridge;
    if (session.platform === 'desktop' && bridge) {
      const lock = await bridge.lock.status();
      if (lock.hasPin) {
        setPin('');
        setPinError(false);
        setState('pin');
        return;
      }
      return void run(scope);
    }
    try {
      const r = await reauthenticate(`/settings/data?export=${scope}`);
      if (r.wait) nav(r.wait);
    } catch {
      setState('failed');
    }
  };
  const checkPin = async () => {
    const r = await session.bridge?.lock.verify(pin);
    if (r?.ok) return void run(scope);
    setPinError(true);
  };

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.data}
        backLabel={copy.back}
        backTo={copy.title}
        onBack={() => nav('/settings')}
      />
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.exportTitle} />
        <ChoiceCards<Scope>
          label={copy.scopeLabel}
          value={scope}
          onChange={setScope}
          autoAdvance={false}
          options={[
            { value: 'mine', label: copy.scope.mine ?? '' },
            { value: 'joint', label: copy.scope.joint ?? '' },
          ]}
        />
        <p className="hg-q__help">
          {copy.formatCsv}. {copy.noPhotos}
        </p>
        {state === 'pin' && (
          <form
            className="hg-row"
            style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}
            onSubmit={(e) => {
              e.preventDefault();
              void checkPin();
            }}
          >
            <div style={{ flex: 1 }}>
              <Field
                label={copy.pinQ}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                error={pinError ? copy.pinWrong : undefined}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <Button variant="primary" type="submit" disabled={pin.length < 4}>
              {copy.confirmMe}
            </Button>
          </form>
        )}
        {state === 'failed' ? (
          <div className="hg-banner hg-banner--info" role="alert">
            <span>{copy.exportFailed}</span>
            <Button variant="secondary" size="sm" onClick={() => void start()}>
              {copy.retry}
            </Button>
          </div>
        ) : (
          state !== 'pin' && (
            <div className="hg-row">
              <Button
                variant="primary"
                disabled={state === 'busy'}
                aria-busy={state === 'busy'}
                onClick={() => void start()}
              >
                {state === 'busy' ? copy.exporting : copy.doExport}
              </Button>
            </div>
          )
        )}
      </section>
      <div className="hg-list">
        <ListRow
          label={copy.trash}
          value={copy.trashCount(trash.data?.length ?? 0)}
          onClick={() => nav('/settings/trash')}
        />
      </div>
      <section className="hg-stack" style={{ gap: 'var(--space-2)' }}>
        <Toggle
          label={copy.analytics}
          help={copy.analyticsSub}
          checked={!me.analytics_off}
          onChange={(on) =>
            void updateMe({ analytics_off: !on })
              .then(() => qc.invalidateQueries({ queryKey: qk.me }))
              .catch(() => toast(copy.failed))
          }
        />
      </section>
      <div className="hg-list">
        <ListRow label={copy.deleteAccount} onClick={() => nav('/settings/data/delete')} />
      </div>
    </div>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}
