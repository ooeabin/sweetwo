import {
  fetchExportData,
  fetchNetWorthHistory,
  fetchPartnerAssetSums,
  fetchTrash,
  qk,
  updateMe,
} from '@sweetwo/api';
import { makeZip, todayKst } from '@sweetwo/core';
import {
  Button,
  ChoiceCards,
  Field,
  Illustration,
  ListRow,
  PageHeader,
  ProcessingState,
  SectionHeader,
  Toggle,
} from '@sweetwo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../../../shared/analytics';
import { carryToast, toast } from '../../../shared/toast';
import { lockedOutState, paths, reauthenticate, session, signOut } from '../../auth';
import { LoadingFrame, MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { buildExport, type Scope } from '../export';
import { markExported, type DataBack } from '../unlink';
import { buildPdfModel, renderPdf } from '../export-pdf';

type Format = 'csv' | 'pdf';

/** 저장: 모바일 앱은 OS 공유 창(‘파일에 저장’), 브라우저(개발·e2e)는 내려받기 */
async function saveFile(name: string, bytes: Uint8Array, mime: string) {
  const bridge = typeof window !== 'undefined' ? window.sweetwo : undefined;
  if (bridge?.saveFile) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return bridge.saveFile({ name, base64: btoa(bin), mime });
  }
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved' as const;
}

// S-18 데이터(docs/spec/25-settings.md): 내보내기(내 데이터 / 공동 데이터, 엑셀 CSV zip, 본인 확인 뒤),
// 형식: 엑셀(CSV zip) / PDF 요약(① 자산 요약 ② 연간 요약, export-pdf).
// 휴지통(→ S-21, 개수), 사용 기록 보내기 토글, 계정 삭제(→ S-18b).
// 본인 확인: 모바일 앱은 PIN(있으면), 앱 잠금이 꺼져 있으면 웹처럼 가입 소셜로 다시 로그인(2026-11-12 QA 11구간 S11-02)
// → 돌아오면 이어서 내보냄(?export=범위&format=형식). PIN 5번 틀리면 A-02(S-15와 같음, S11-07).
export function S18Data() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  // S-18b ‘먼저 내보내기’로 왔으면(?from=delete, 다시 로그인을 거쳐도 남게 주소에) 뒤로·내보낸 뒤 = S-18b(2026-11-12 QA 11구간 D3)
  const fromDelete = params.get('from') === 'delete';
  // 연결 해제 안내(S-12a·d)나 합류 옮기기(P-02a)에서 왔으면 뒤로 = 그 화면(2026-11-11 S3-07)
  const locState = useLocation().state as DataBack | null;
  const from: DataBack | null = fromDelete
    ? { back: '/settings/data/delete', backLabel: copy.deleteAccount }
    : (locState ?? null);
  const d = useSettingsData();
  const trash = useQuery({ queryKey: qk.trash, queryFn: fetchTrash });
  const [scope, setScope] = useState<Scope>((params.get('export') as Scope | null) ?? 'joint');
  const [format, setFormat] = useState<Format>(params.get('format') === 'pdf' ? 'pdf' : 'csv');
  const [step, setStep] = useState<'idle' | 'pin' | 'busy' | 'failed'>('idle');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const auto = useRef(false);

  /** 내보내기. S-18b에서 와서 저장했으면 S-18b로 옮기고 'left' */
  const run = async (s: Scope, f: Format = format): Promise<'left' | undefined> => {
    if (!d.me || !d.c) return;
    setStep('busy');
    const names = { myId: d.me.id, myName: d.c.myName, partnerName: d.c.partnerName };
    const today = todayKst();
    const date = today.replace(/-/g, '');
    try {
      const data = await fetchExportData();
      let r: 'saved' | 'cancelled';
      if (f === 'pdf') {
        const [history, partnerSums] = await Promise.all([
          fetchNetWorthHistory(12),
          fetchPartnerAssetSums(),
        ]);
        const pdf = await renderPdf(buildPdfModel(data, { history, partnerSums }, s, names, today));
        r = await saveFile(copy.pdfName(s, date), pdf, 'application/pdf');
      } else {
        const zip = makeZip(buildExport(data, s, names));
        r = await saveFile(copy.fileName(s, date), zip, 'application/zip');
      }
      setStep('idle');
      track('data_exported', { format: f, scope: s === 'mine' ? 'mine' : 'joint', result: 'done' });
      if (r === 'saved') {
        markExported();
        if (fromDelete) {
          carryToast(copy.exported);
          nav('/settings/data/delete', { replace: true });
          return 'left';
        }
        toast(copy.exported);
      }
    } catch {
      track('data_exported', {
        format: f,
        scope: s === 'mine' ? 'mine' : 'joint',
        result: 'failed',
      });
      setStep('failed');
    }
  };

  // 웹: 다시 로그인하고 돌아오면 이어서 내보냄
  useEffect(() => {
    const s = params.get('export') as Scope | null;
    if (!s || auto.current || !d.me || !d.c) return;
    auto.current = true;
    void run(s, params.get('format') === 'pdf' ? 'pdf' : 'csv').then((r) => {
      if (r !== 'left') setParams(fromDelete ? { from: 'delete' } : {}, { replace: true });
    });
  }, [d.me, d.c]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading || !d.me || !d.c) return <LoadingFrame sub="settings" current={null} />;
  const me = d.me;

  const start = async () => {
    const bridge = session.bridge;
    if (bridge) {
      const lock = await bridge.lock.status();
      if (lock.hasPin) {
        setPin('');
        setPinError(false);
        setStep('pin');
        return;
      }
    }
    // 웹, 또는 앱 잠금이 꺼진 모바일 앱: 가입 소셜로 다시 로그인(25 S-18 2번 ‘앱 잠금이 꺼져 있으면 재로그인’)
    try {
      const back = fromDelete ? '&from=delete' : '';
      const r = await reauthenticate(`/settings/data?export=${scope}&format=${format}${back}`);
      if (r.wait) nav(r.wait);
    } catch {
      setStep('failed');
    }
  };
  const checkPin = async () => {
    const r = await session.bridge?.lock.verify(pin);
    if (r?.ok) return void run(scope);
    if (r?.signedOut) {
      // 5번 틀림: 브리지가 로그아웃하고 PIN을 지웠다 → 이 기기 데이터 비우고 A-02 + 안내(S-15·A-06과 같음)
      await signOut({ forgetPin: true });
      return void nav(paths.login, { replace: true, state: lockedOutState });
    }
    setPinError(true);
  };

  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={copy.data}
        backLabel={copy.back}
        backTo={from?.backLabel ?? copy.title}
        onBack={() => nav(from?.back ?? '/settings', { replace: !!from })}
      />
      <section className="hg-stack" style={{ gap: 'var(--space-3)' }}>
        <SectionHeader title={copy.exportTitle} />
        {/* 2026-11-03 범위와 형식이 한 묶음처럼 보여서 이름을 붙이고, 내보내기는 가득 너비 버튼 */}
        <p className="hg-field__label">{copy.scopeLabel}</p>
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
        <p className="hg-field__label">{copy.formatLabel}</p>
        <ChoiceCards<Format>
          label={copy.formatLabel}
          autoFocus={false}
          shortcuts={false}
          value={format}
          onChange={setFormat}
          autoAdvance={false}
          options={[
            { value: 'csv', label: copy.formatCsv },
            { value: 'pdf', label: copy.formatPdf },
          ]}
        />
        <p className="hg-q__help">{copy.noPhotos}</p>
        {step === 'pin' && (
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
        {step === 'failed' ? (
          <div className="hg-banner hg-banner--info" role="alert">
            <span>{copy.exportFailed}</span>
            <Button variant="secondary" size="sm" onClick={() => void start()}>
              {copy.retry}
            </Button>
          </div>
        ) : (
          step !== 'pin' && (
            <div className="hg-row">
              <Button
                variant="primary"
                block
                disabled={step === 'busy'}
                aria-busy={step === 'busy'}
                onClick={() => void start()}
              >
                {step === 'busy' ? copy.exporting : copy.doExport}
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
            updateMe({ analytics_off: !on })
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
  // 2026-11-04 파일을 만드는 동안은 처리 중 화면(그림 자리 + 한 문장, 카카오페이·토스처럼)
  const busy = (
    <ProcessingState
      icon="download"
      art={<Illustration name="busy-file" motion />}
      title={copy.exporting}
      sub={copy.exportingSub}
    />
  );
  return <MainFrame sub="settings" current={null} columns={[step === 'busy' ? busy : body]} />;
}
