import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { AmountInput } from './question/AmountInput';
import { useNarrow } from './question/useNarrow';
import { StickyBar } from './StickyBar';

// 한 화면 입력 틀(docs/design/components/FormScreen.md, 2026-11-23). 온보딩 밖에서 쓰는 단계형(진행 막대 + 한 화면 한 질문) 입력을
// 한 화면으로 바꾼 틀: 머리(‹ + 가운데 제목) → 맨 위 요약 문장(고르는 대로 바뀜) → 질문 섹션들 → 접힌 선택 줄 → 아래 고정 주 버튼.
// 온보딩(O-xx)·파트너 합류(P-xx)의 단계형은 QuestionLayout 그대로.
export function FormScreen({
  title,
  backLabel = '뒤로',
  backTo,
  onBack,
  hero,
  children,
  primary,
  onSubmit,
}: {
  /** 머리 가운데 제목(“저축·투자 추가”) */
  title: string;
  backLabel?: string;
  /** 넓은 창 머리의 돌아갈 화면 이름 */
  backTo?: string;
  onBack: () => void;
  /** 맨 위 요약 문장. FormHero로 만든 것 */
  hero?: ReactNode;
  children: ReactNode;
  primary: { label: string; disabled?: boolean; loading?: boolean };
  onSubmit: () => void;
}) {
  // Esc = 뒤로(시트·대화상자가 열려 있으면 그것만 닫음, QuestionLayout과 같음)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  return (
    <main className="hg-qmain hg-formmain">
      <form
        className="hg-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!primary.disabled && !primary.loading) onSubmit();
        }}
      >
        <PageHeader title={title} backLabel={backLabel} backTo={backTo} onBack={onBack} />
        {hero}
        {children}
        <StickyBar>
          <Button
            type="submit"
            variant="primary"
            block
            disabled={primary.disabled}
            loading={primary.loading}
          >
            {primary.label}
          </Button>
        </StickyBar>
      </form>
    </main>
  );
}

/** 요약 문장 조각: ink 글자(기본) 또는 고른 금액(accent, `accent-app-text`) */
export interface HeroPart {
  text: string;
  tone?: 'ink' | 'accent';
}

/**
 * 맨 위 요약 문장(22px 700). lines = 줄마다 조각들(이름 자리 ink, 금액 자리만 accent). 고를 때마다 바뀌어 화면 읽기가 읽음(aria-live).
 * 줄 사이는 `<br>` 없이 블록 줄 + 공백 글자로 나눠 화면 읽기가 한 문장으로 읽음
 */
export function FormHero({ lines }: { lines: HeroPart[][] }) {
  return (
    <h2 className="hg-form__hero" aria-live="polite">
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="hg-form__heroline">
            {line.map((p, j) => (
              <Fragment key={j}>
                {p.tone === 'accent' ? <span className="hg-form__val">{p.text}</span> : p.text}
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
    </h2>
  );
}

/** 질문 섹션: 질문 제목(15px 700) + 오른쪽 보조 글자(slate) + 칩 묶음이나 입력 */
export function FormSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="hg-form__sec">
      <div className="hg-form__q">
        <h3 className="hg-form__qtitle">{title}</h3>
        {aside && <span className="hg-form__aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** 선택 항목 묶음: 회색 구분 띠 아래 접힌 줄들(FormFold) */
export function FormFolds({ children }: { children: ReactNode }) {
  return <div className="hg-form__folds">{children}</div>;
}

/** 접힌 줄: 이름 + 오른쪽 값 또는 “정하기 ›”. 누르면 기존 휠·금액 시트를 엶 */
export function FormFold({
  label,
  value,
  placeholder = '정하기',
  onClick,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="hg-form__fold"
      aria-haspopup="dialog"
      aria-label={`${label}, ${value ?? placeholder}`}
      onClick={onClick}
    >
      <span className="hg-form__foldlabel">{label}</span>
      <span className={value ? 'hg-form__foldval is-set' : 'hg-form__foldval'}>
        {value ?? placeholder}
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  );
}

/**
 * 금액 입력(질문 섹션 안). 좁은 창은 칸을 누르면 기존 키패드가 아래 시트로 올라옴(화면 안에 키패드를 두면 요약 문장과 주 버튼을 가려서),
 * 넓은 창은 칸에 바로 입력(AmountInput embedded). 빠른 칩은 두 경우 모두 칸 아래.
 * 첫 숫자가 미리 채운 값을 덮어쓰고 999억 상한 흔들림은 AmountInput 규칙 그대로(시트 안 AmountInput).
 */
export function FormAmount({
  label,
  value,
  onChange,
  quick,
  allowZero = true,
  monthly = true,
  invalid,
  sheetTitle,
  closeLabel = '닫기',
  confirmLabel = '확인',
  below,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  quick?: readonly { label: string; value: number }[];
  allowZero?: boolean;
  monthly?: boolean;
  invalid?: boolean;
  /** 키패드 시트 제목 */
  sheetTitle: string;
  closeLabel?: string;
  confirmLabel?: string;
  /** 칸 아래 안내·오류 */
  below?: ReactNode;
}) {
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<number | null>(value);
  if (!narrow)
    return (
      <>
        <AmountInput
          label={label}
          value={value}
          onChange={onChange}
          quick={quick}
          quickSet
          monthly={monthly}
          allowZero={allowZero}
          embedded
        />
        {below && <div className="hg-form__below">{below}</div>}
      </>
    );
  return (
    <div className="hg-amountin">
      <button
        type="button"
        className={`hg-amount hg-form__amountbtn${invalid ? ' is-error' : ''}`}
        aria-haspopup="dialog"
        aria-label={`${label}, ${value === null ? '비어 있음' : `${value.toLocaleString('ko-KR')}원`}`}
        onClick={() => {
          setTemp(value);
          setOpen(true);
        }}
      >
        <span className={`hg-amount__value${value === null ? ' is-empty' : ''}`}>
          {value === null ? '0' : value.toLocaleString('ko-KR')}
        </span>
        <span className="hg-amount__unit">원</span>
      </button>
      {quick && (
        <div className="hg-quick" role="group" aria-label={`${label} 빠른 금액`}>
          {quick.map((q) => (
            <Chip
              key={q.label}
              small
              selected={value === q.value}
              onClick={() => onChange(q.value)}
            >
              {q.label}
            </Chip>
          ))}
        </div>
      )}
      {below && <div className="hg-form__below">{below}</div>}
      {open && (
        <BottomSheet
          title={sheetTitle}
          closeLabel={closeLabel}
          onClose={() => setOpen(false)}
          actions={
            <Button
              variant="primary"
              block
              onClick={() => {
                onChange(temp);
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          }
        >
          <AmountInput
            label={label}
            value={temp}
            onChange={setTemp}
            monthly={monthly}
            allowZero={allowZero}
          />
        </BottomSheet>
      )}
    </div>
  );
}
