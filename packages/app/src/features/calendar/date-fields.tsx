import { Chip, Field, Tabs } from '@sweetwo/ui';
import { copy } from './copy';

// 생일·기념일 월·일 + 양력/음력(윤달) 입력(Y-02b, Y-03d, Y-03e). 태어난 해는 고를 때만
export interface MonthDay {
  month: number | null;
  day: number | null;
  lunar: boolean;
  leap: boolean;
}

/** 월 1~12, 일 1~31(음력 1~30) 밖이면 true */
export const badMonthDay = (p: MonthDay) =>
  (p.month !== null && (p.month < 1 || p.month > 12)) ||
  (p.day !== null && (p.day < 1 || p.day > (p.lunar ? 30 : 31)));

const num = (v: string, len = 2) => {
  const n = v.replace(/\D/g, '').slice(0, len);
  return n ? Number(n) : null;
};

export function MonthDayFields({
  label,
  value,
  onChange,
  year,
}: {
  label: string;
  value: MonthDay;
  onChange: (p: Partial<MonthDay>) => void;
  /** 태어난 해(선택) */
  year?: { value: number | null; onChange: (v: number | null) => void; error?: string };
}) {
  const bad = badMonthDay(value);
  return (
    <>
      <Tabs<'solar' | 'lunar'>
        variant="seg"
        label={label}
        value={value.lunar ? 'lunar' : 'solar'}
        onChange={(v) => onChange({ lunar: v === 'lunar', leap: false })}
        items={[
          { value: 'solar', label: copy.solar },
          { value: 'lunar', label: copy.lunar },
        ]}
      />
      <div className="hg-fields">
        <Field
          label={copy.month}
          inputMode="numeric"
          value={value.month ?? ''}
          onChange={(e) => onChange({ month: num(e.target.value) })}
        />
        <Field
          label={copy.day}
          inputMode="numeric"
          value={value.day ?? ''}
          onChange={(e) => onChange({ day: num(e.target.value) })}
          error={bad ? copy.dateError : undefined}
        />
      </div>
      {value.lunar && (
        <Chip small selected={value.leap} onClick={() => onChange({ leap: !value.leap })}>
          {copy.leapMonth}
        </Chip>
      )}
      {year && (
        <Field
          label={copy.birthYear}
          inputMode="numeric"
          value={year.value ?? ''}
          onChange={(e) => year.onChange(num(e.target.value, 4))}
          error={year.error}
        />
      )}
    </>
  );
}
