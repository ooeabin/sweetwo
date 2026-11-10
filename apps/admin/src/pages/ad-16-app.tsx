import { adminRequestAppConfig, fetchAdminAppConfig } from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '../act';
import { copy, ops } from '../copy';
import { Frame } from '../frame';
import { useToast } from '../toast';
import { useAdmin } from '../gate';
import { SysTabs } from '../sys-tabs';

const toIso = (local: string) => (local ? new Date(`${local}:00+09:00`).toISOString() : null);
const local = (iso: string | null) => (iso ? formatKstDateTime(iso).replace(' ', 'T') : '');

// AD-16 앱 버전·점검: 최소 지원 버전(iOS, Android. 웹은 설정 없음), 점검 예약(시작·끝·문구). 저장 = 승인 요청(최고 관리자).
// 데스크톱 최신·최소 버전 칸은 없앰(2026-11-10, ADR 0008). DB 열(latest_version_desktop, min_version_desktop)은 남김(나중에 2단계로 지움).
// 앱은 최소 버전 미만이면 강제 업데이트(A-01), 점검 시간 안이면 ‘점검’ 화면(13 13번).
// 최소 지원 버전마다 지금 저장된 버전보다 낮은 기기 수(90일 안에 켠 기기, app_device)를 칸 아래에.
export function AD16App() {
  const me = useAdmin();
  const canEdit = me.roles.includes('ops') || me.roles.includes('super');
  const q = useQuery({ queryKey: ['admin', 'app-config'], queryFn: fetchAdminAppConfig });
  const [f, setF] = useState({
    minI: '',
    minA: '',
    starts: '',
    ends: '',
    message: '',
  });
  const setMsg = useToast();
  useEffect(() => {
    if (!q.data) return;
    setF({
      minI: q.data.min_version_ios,
      minA: q.data.min_version_android,
      starts: local(q.data.maintenance_starts_at),
      ends: local(q.data.maintenance_ends_at),
      message: q.data.maintenance_message ?? '',
    });
  }, [q.data]);
  const ver = /^\d+\.\d+\.\d+$/;
  const ready =
    ver.test(f.minI) && ver.test(f.minA) && (!f.starts || (!!f.ends && f.ends > f.starts));
  const save = async () => {
    setMsg(null);
    try {
      await adminRequestAppConfig({
        min_version_ios: f.minI,
        min_version_android: f.minA,
        maintenance_starts_at: toIso(f.starts),
        maintenance_ends_at: f.starts ? toIso(f.ends) : null,
        maintenance_message: f.starts ? f.message || null : null,
      });
      setMsg(ops.requestedApproval);
    } catch {
      setMsg(copy.failed);
    }
  };
  const below = q.data?.below_min;
  const field = (label: string, k: keyof typeof f, type = 'text', help?: number) => (
    <label className="hg-field">
      <span className="hg-field__label">{label}</span>
      <input
        className="hg-input"
        type={type}
        value={f[k]}
        disabled={!canEdit}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
      {help !== undefined && <span className="hg-help">{ops.belowMin(help)}</span>}
    </label>
  );
  return (
    <Frame menu="system" title={ops.systemTitle}>
      <SysTabs current="app" />
      <section className="hg-card hg-stack" aria-label={ops.sysTabs.app} style={{ maxWidth: 520 }}>
        {field(ops.appCols.minIos, 'minI', 'text', below?.ios)}
        {field(ops.appCols.minAndroid, 'minA', 'text', below?.android)}
        <span className="hg-card__label">{ops.maintenance}</span>
        {field(ops.field.starts, 'starts', 'datetime-local')}
        {field(ops.field.ends, 'ends', 'datetime-local')}
        {field(ops.maintenanceMsg, 'message')}
        {canEdit && (
          <Button variant="primary" disabled={!ready} onAct={() => save()}>
            {ops.requestApproval}
          </Button>
        )}
      </section>
    </Frame>
  );
}
