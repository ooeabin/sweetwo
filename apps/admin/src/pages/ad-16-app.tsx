import { adminRequestAppConfig, fetchAdminAppConfig } from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { Button } from '@sweetwo/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { copy, ops } from '../copy';
import { Frame } from '../frame';
import { useAdmin } from '../gate';
import { SysTabs } from '../sys-tabs';

const toIso = (local: string) => (local ? new Date(`${local}:00+09:00`).toISOString() : null);
const local = (iso: string | null) => (iso ? formatKstDateTime(iso).replace(' ', 'T') : '');

// AD-16 앱 버전·점검: 최신·최소 지원 버전, 점검 예약(시작·끝·문구). 저장 = 승인 요청(최고 관리자).
// 앱은 최소 버전 미만이면 강제 업데이트(A-01), 점검 시간 안이면 ‘점검’ 화면(13 13번). 미만 기기 수는 기기 접속 기록이 쌓인 뒤.
export function AD16App() {
  const me = useAdmin();
  const canEdit = me.roles.includes('ops');
  const q = useQuery({ queryKey: ['admin', 'app-config'], queryFn: fetchAdminAppConfig });
  const [f, setF] = useState({ latest: '', minD: '', minW: '', starts: '', ends: '', message: '' });
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    setF({
      latest: q.data.latest_version_desktop,
      minD: q.data.min_version_desktop,
      minW: q.data.min_version_web,
      starts: local(q.data.maintenance_starts_at),
      ends: local(q.data.maintenance_ends_at),
      message: q.data.maintenance_message ?? '',
    });
  }, [q.data]);
  const ver = /^\d+\.\d+\.\d+$/;
  const ready =
    ver.test(f.latest) &&
    ver.test(f.minD) &&
    ver.test(f.minW) &&
    (!f.starts || (!!f.ends && f.ends > f.starts));
  const save = async () => {
    setMsg(null);
    try {
      await adminRequestAppConfig({
        latest_version_desktop: f.latest,
        min_version_desktop: f.minD,
        min_version_web: f.minW,
        maintenance_starts_at: toIso(f.starts),
        maintenance_ends_at: f.starts ? toIso(f.ends) : null,
        maintenance_message: f.starts ? f.message || null : null,
      });
      setMsg(ops.requestedApproval);
    } catch {
      setMsg(copy.failed);
    }
  };
  const field = (label: string, k: keyof typeof f, type = 'text') => (
    <label className="hg-field">
      <span className="hg-field__label">{label}</span>
      <input
        className="hg-input"
        type={type}
        value={f[k]}
        disabled={!canEdit}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </label>
  );
  return (
    <Frame menu="system" title={ops.systemTitle}>
      <SysTabs current="app" />
      <section className="hg-card hg-stack" aria-label={ops.sysTabs.app} style={{ maxWidth: 520 }}>
        {field(ops.appCols.latest, 'latest')}
        {field(ops.appCols.minDesktop, 'minD')}
        {field(ops.appCols.minWeb, 'minW')}
        <span className="hg-card__label">{ops.maintenance}</span>
        {field(ops.field.starts, 'starts', 'datetime-local')}
        {field(ops.field.ends, 'ends', 'datetime-local')}
        {field(ops.maintenanceMsg, 'message')}
        {msg && (
          <p className="hg-help" role="status">
            {msg}
          </p>
        )}
        {canEdit && (
          <Button variant="primary" disabled={!ready} onClick={() => void save()}>
            {ops.requestApproval}
          </Button>
        )}
      </section>
    </Frame>
  );
}
