import { adminSearch, type AdminSearchRow } from '@sweetwo/api';
import { formatKstDateTime } from '@sweetwo/core';
import { Button, DataTable } from '@sweetwo/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';
import { Frame } from '../frame';

// AD-02 회원·부부 검색: 이메일, 사용자 ID, 부부 공간 ID, 문의 번호 정확히 일치만. 1건이면 AD-03으로 바로.
// 결과 표는 L0(이메일 앞 3자 외 가림). 검색도 감사 로그(서버). 내려받기(L0, 사유)는 다음 단계.
export function AD02Members() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminSearchRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const search = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setErr(false);
    try {
      const r = await adminSearch(q.trim());
      if (r.length === 1 && r[0]) return nav(`/members/${r[0].user_id}`);
      setRows(r);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame menu="members" title={copy.menus.members}>
      <form
        className="hg-row"
        style={{ gap: 'var(--space-2)' }}
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          className="hg-input"
          aria-label={copy.search}
          placeholder={copy.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button variant="primary" type="submit" aria-busy={busy}>
          {copy.see}
        </Button>
      </form>
      {err && <p className="hg-help is-error">{copy.failed}</p>}
      {rows && (
        <DataTable
          label={copy.menus.members}
          rows={rows}
          rowKey={(r) => r.user_id}
          onRow={(r) => nav(`/members/${r.user_id}`)}
          empty={copy.noMember}
          columns={[
            { key: 'id', label: copy.cols.userId, render: (r) => r.user_id },
            {
              key: 'email',
              label: copy.cols.email,
              render: (r) => <span className="hg-mask-text">{r.email_masked}</span>,
            },
            {
              key: 'joined',
              label: copy.cols.joined,
              render: (r) => formatKstDateTime(r.created_at).slice(0, 10),
            },
            {
              key: 'couple',
              label: copy.cols.couple,
              render: (r) => copy.coupleStates[r.couple_state ?? ''] ?? '—',
            },
            { key: 'sub', label: copy.cols.sub, render: (r) => r.subscription },
          ]}
        />
      )}
    </Frame>
  );
}
