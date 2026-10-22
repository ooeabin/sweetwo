import { qk, setChecklistDone } from '@sweetwo/api';
import { formatDateFull } from '@sweetwo/core';
import { Button, PageHeader, SectionHeader } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MainFrame } from '../../month';
import { toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';
import { CHECKLIST, guidesPath, useChecklist } from '../guides';

// S-02 체크리스트 항목(25 S-02): 제목·설명(3줄 이내), 해야 할 일 단계, 출처(공식 사이트)·확인일, 완료자 표시, 관련 기능 링크.
// 이번 달 할 일에서 열면(?from=todo) “완료했어요”. 완료는 부부 공유.
export function S02ChecklistItem() {
  const { key = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const ck = useChecklist(d.space);
  const [saving, setSaving] = useState(false);
  const item = CHECKLIST.flatMap((s) => s.items).find((i) => i.key === key);
  if (!item) return <Navigate to={guidesPath} replace />;
  if (d.loading || ck.loading || !d.c) return <MainFrame current={null} columns={[null]} />;
  const fromTodo = params.get('from') === 'todo';
  const done = ck.doneOf(key);
  const who = done ? (done.done_by === d.me?.id ? d.c.myName : d.c.partnerName) : null;
  const back = () => nav(fromTodo ? '/' : guidesPath);
  const toggle = async (v: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await setChecklistDone(key, v);
      await qc.invalidateQueries({ queryKey: qk.checklistDone });
      if (v) back();
    } catch {
      toast(copy.failed);
    } finally {
      setSaving(false);
    }
  };
  const body = (
    <div className="hg-stack" style={{ gap: 'var(--space-6)' }}>
      <PageHeader
        title={item.title}
        backLabel={copy.back}
        backTo={fromTodo ? undefined : copy.guidesTitle}
        onBack={back}
      />
      <p style={{ margin: 0 }}>{item.desc}</p>
      {item.steps.length > 0 && (
        <section className="hg-stack">
          <SectionHeader title={copy.steps} />
          <ol className="hg-stack" style={{ margin: 0, paddingLeft: 'var(--space-6)' }}>
            {item.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}
      {item.sources.length > 0 && (
        <section className="hg-stack">
          <SectionHeader title={copy.sources} />
          {item.sources.map((s) => (
            <p key={s.url} className="hg-card__meta" style={{ margin: 0 }}>
              <button
                type="button"
                className="hg-btn hg-btn--link"
                onClick={() => window.open(s.url, '_blank', 'noopener')}
              >
                {s.name}
              </button>{' '}
              {copy.checked(formatDateFull(s.checked))}
            </p>
          ))}
        </section>
      )}
      {item.feature && (
        <Button variant="secondary" onClick={() => item.feature && nav(item.feature.path)}>
          {item.feature.label}
        </Button>
      )}
      {who && (
        <p className="hg-card__meta" role="status">
          {copy.doneBy(who)}
        </p>
      )}
      {fromTodo &&
        (done ? (
          <Button variant="secondary" disabled={saving} onClick={() => void toggle(false)}>
            {copy.undo}
          </Button>
        ) : (
          <Button variant="primary" disabled={saving} onClick={() => void toggle(true)}>
            {copy.markDone}
          </Button>
        ))}
    </div>
  );
  return <MainFrame current={null} page={{ title: item.title }} columns={[body]} />;
}
