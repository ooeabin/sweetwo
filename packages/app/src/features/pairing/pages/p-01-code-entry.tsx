import { QuestionLayout } from '@sweetwo/ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { paths } from '../../auth';
import { copy } from '../copy';

// 초대 코드: 영문 대문자와 숫자 6자(헷갈리는 I, O, 0, 1은 안 씀). DB 검사와 같은 규칙
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

// P-01 합류 시작, 코드 직접 입력(2026-11-03 질문 화면 틀: 제목 위, 코드 칸 바로 아래)(O-01 ‘코드 입력하기’로 들어온 길). 링크로 오면 코드가 이미 있어 /i/:code로 바로 간다.
// 2026-11-11 D4: 로그인 뒤에도 O-06·S-12 ‘받은 초대 코드가 있어요 ›’, 합류 불가 ‘코드 다시 입력하기’로 옴.
// 뒤로는 들어온 곳(state.from)으로, 없으면 O-01(S3-28: 합류 불가 화면으로 돌아가던 것)
export function P01CodeEntry() {
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? paths.start;
  const [code, setCode] = useState('');
  const valid = CODE.test(code);
  const bad = code.length === 6 && !valid;

  return (
    <QuestionLayout
      title={copy.codeTitle}
      help={copy.codeHelp}
      onBack={() => nav(from, { replace: true })}
      primary={{ label: copy.next, disabled: !valid }}
      onSubmit={() => valid && nav(`/i/${code}`, { state: { typed: true } })}
    >
      <div className="hg-field">
        <label className="hg-field__label" htmlFor="p-01-code-input">
          {copy.codeLabel}
        </label>
        <input
          id="p-01-code-input"
          className={bad ? 'hg-input hg-input--code is-error' : 'hg-input hg-input--code'}
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
    </QuestionLayout>
  );
}
