import { useId } from 'react';
import { Icon } from './Icon';

// 검색 칸(docs/design/components/Search.md). 라벨은 화면 읽기용.
export function Search({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="hg-search">
      <Icon name="search" />
      <label htmlFor={id} className="hg-sr">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
