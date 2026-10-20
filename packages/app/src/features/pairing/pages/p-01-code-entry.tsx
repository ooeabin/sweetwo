import { AuthLayout, Button } from '@sweetwo/ui';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '../copy';

// 초대 코드: 영문 대문자와 숫자 6자(헷갈리는 I, O, 0, 1은 안 씀). DB 검사와 같은 규칙
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

// P-01 합류 시작, 코드 직접 입력(O-01 ‘초대받았어요’로 들어온 길). 링크로 오면 코드가 이미 있어 /i/:code로 바로 간다.
export function P01CodeEntry() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const valid = CODE.test(code);
  const bad = code.length === 6 && !valid;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) nav(`/i/${code}`);
  };

  return (
    <AuthLayout
      title={copy.codeTitle}
      help={copy.codeHelp}
      onBack={() => nav(-1)}
      actions={
        <form className="hg-auth__actions" noValidate onSubmit={submit}>
          <div className="hg-field">
            <label className="hg-field__label" htmlFor="p-01-code-input">
              {copy.codeLabel}
            </label>
            <input
              id="p-01-code-input"
              className={bad ? 'hg-input is-error' : 'hg-input'}
              style={{ textAlign: 'center', letterSpacing: 'var(--space-2)' }}
              value={code}
              autoFocus
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              aria-invalid={bad}
              aria-describedby={bad ? 'p-01-code-error' : undefined}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 6),
                )
              }
            />
            {bad && (
              <p id="p-01-code-error" className="hg-help is-error" role="alert">
                {copy.errors.invalid}
              </p>
            )}
          </div>
          <Button variant="primary" block type="submit" disabled={!valid}>
            {copy.next}
          </Button>
        </form>
      }
    />
  );
}
