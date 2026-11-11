import { createInquiry, qk, type InquiryCategory } from '@sweetwo/api';
import { QuestionLayout, Toggle } from '@sweetwo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectPlatform } from '../../../platform';
import { SheetSelect } from '../../../shared/sheet-select';
import { carryToast, toast } from '../../../shared/toast';
import { copy } from '../copy';
import { useSettingsData } from '../data';

const CATS: InquiryCategory[] = ['account', 'couple', 'calc', 'sync', 'billing', 'privacy', 'etc'];

// S-19a 문의하기: 분류 + 내용 + “앱 정보 함께 보내기”(기본 켜짐). 자동 첨부는 앱 버전·OS·우리 둘 상태·동기화 상태만
// (금액·메모 없음, 서버도 키를 거름). 번호는 서버가 발급 → “문의 #A-10234를 받았어요” → 내 문의.
// help@ 사본 메일은 메일 발송과 함께.
export function S19aInquiry() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useSettingsData();
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
            app_version: platform !== 'web' ? (window.sweetwo?.appVersion ?? '') : 'web',
            platform,
            os: /iPhone|iPad/.test(navigator.userAgent)
              ? 'ios'
              : navigator.userAgent.includes('Android')
                ? 'android'
                : navigator.userAgent.includes('Mac')
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
      carryToast(copy.inquirySent(no));
      nav('/settings/help/inquiries', { replace: true });
    } catch {
      toast(copy.failed);
      setBusy(false);
    }
  };
  // 2026-11-04 ‘보내기’는 화면 아래 꽉 찬 주 버튼(질문 화면과 같은 자리)
  return (
    <QuestionLayout
      title={copy.contact}
      onBack={() => nav('/settings/help')}
      primary={{ label: copy.sendInquiry, disabled: !ok, loading: busy }}
      onSubmit={() => void send()}
    >
      <div className="hg-list">
        <SheetSelect<InquiryCategory>
          label={copy.categoryLabel}
          rowLabel={copy.categoryLabel}
          value={cat}
          options={CATS}
          nameOf={(c) => copy.categories[c] ?? c}
          onChange={setCat}
        />
      </div>
      <InquiryText value={text} onChange={setText} />
      <Toggle
        label={copy.attachApp}
        help={copy.attachAppSub}
        checked={attach}
        onChange={setAttach}
      />
    </QuestionLayout>
  );
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
