import { createInquiry, qk, type InquiryCategory } from '@sweetwo/api';
import { Button, PageHeader, Toggle } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectPlatform } from '../../../platform';
import { toast } from '../../../shared/toast';
import { MainFrame } from '../../frame';
import { copy } from '../copy';
import { useSettingsData } from '../data';

const CATS: InquiryCategory[] = ['account', 'couple', 'calc', 'sync', 'billing', 'privacy', 'etc'];

// S-19a 문의하기: 분류 + 내용 + “앱 정보 함께 보내기”(기본 켜짐). 자동 첨부는 앱 버전·OS·부부 상태·동기화 상태만
// (금액·메모 없음, 서버도 키를 거름). 번호는 서버가 발급 → “문의 #A-10234를 받았어요” → 내 문의.
// help@ 사본 메일은 메일 발송과 함께.
export function S19aInquiry() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
  const id = useId();
  const [cat, setCat] = useState<InquiryCategory>('etc');
  const [text, setText] = useState('');
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const ok = text.trim().length > 0 && text.length <= 2000;
  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const platform = detectPlatform();
      const info = attach
        ? {
            app_version: platform === 'desktop' ? (window.sweetwo?.appVersion ?? '') : 'web',
            platform,
            os: navigator.userAgent.includes('Mac')
              ? 'mac'
              : navigator.userAgent.includes('Win')
                ? 'windows'
                : 'other',
            couple_state: d.space?.couple_state ?? '',
            sync: navigator.onLine ? 'online' : 'offline',
          }
        : null;
      const no = await createInquiry(cat, text.trim(), info);
      await qc.invalidateQueries({ queryKey: qk.inquiries });
      toast(copy.inquirySent(no));
      nav('/settings/help/inquiries', { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  const body = (
    <form
      className="hg-stack"
      style={{ gap: 'var(--space-6)' }}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <PageHeader
        title={copy.contact}
        backLabel={copy.back}
        backTo={copy.help}
        onBack={() => nav('/settings/help')}
      />
      <div className="hg-field">
        <label className="hg-field__label" htmlFor={id}>
          {copy.categoryLabel}
        </label>
        <select
          id={id}
          className="hg-input"
          value={cat}
          onChange={(e) => setCat(e.target.value as InquiryCategory)}
        >
          {CATS.map((c) => (
            <option key={c} value={c}>
              {copy.categories[c]}
            </option>
          ))}
        </select>
      </div>
      <InquiryText value={text} onChange={setText} />
      <Toggle
        label={copy.attachApp}
        help={copy.attachAppSub}
        checked={attach}
        onChange={setAttach}
      />
      <div className="hg-row">
        <Button variant="primary" type="submit" disabled={!ok || busy}>
          {copy.sendInquiry}
        </Button>
      </div>
    </form>
  );
  return <MainFrame current={null} page={{ title: copy.title }} columns={[body]} />;
}

/** 여러 줄 내용 칸(입력 칸 모양 그대로, 높이만 늘림) */
export function InquiryText({
  value,
  onChange,
  label = copy.bodyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="hg-field">
      <label className="hg-field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="hg-input"
        style={{
          height: 'auto',
          minHeight: 'calc(var(--space-22) * 2)',
          paddingBlock: 'var(--space-3)',
        }}
        maxLength={2000}
        value={value}
        aria-describedby={`${id}-h`}
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={`${id}-h`} className="hg-help">
        {copy.bodyHelp}
      </span>
    </div>
  );
}
