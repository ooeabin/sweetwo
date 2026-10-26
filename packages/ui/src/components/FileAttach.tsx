import { useId, useRef, useState, type DragEvent } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

// 파일 첨부 칸(docs/design/components/FileAttach.md): 한 줄 올리기 칸(고르기·끌어 놓기) → 한도 1줄 → 파일 목록(미리보기, 이름, 보조 줄, 빼기).
export interface AttachFile {
  key: string;
  name: string;
  /** 보조 줄(크기) */
  sub: string;
  /** 미리보기 그림 주소(사진) */
  thumb?: string;
  /** 올리는 중이면 0~1 */
  progress?: number;
  /** 오류 문구(줄 테두리 danger) */
  error?: string;
  /** 올리기 실패면 “다시 시도” */
  onRetry?: () => void;
}

export interface FileAttachProps {
  label: string;
  /** “파일을 끌어 놓거나” */
  drop: string;
  /** 글자 링크 “골라 주세요” */
  pick: string;
  /** 한도 1줄(늘 보임) */
  help: string;
  accept: string;
  multiple?: boolean;
  /** 한도를 다 채움: 올리기 칸 비활성 모양, 끌어 놓으면 fullText */
  full?: boolean;
  fullText?: string;
  /** 칸 아래 오류(형식, 크기, 개수) */
  error?: string | null;
  files: AttachFile[];
  onFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
  removeLabel: (name: string) => string;
  retryLabel: string;
  uploadingLabel: string;
}

export function FileAttach(p: FileAttachProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [fullHit, setFullHit] = useState(false);
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (p.full) return setFullHit(true);
    setFullHit(false);
    p.onFiles(files);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };
  const error = p.error ?? (fullHit && p.full ? p.fullText : null);
  return (
    <div className="hg-attach">
      <span className="hg-field__label" id={`${id}-l`}>
        {p.label}
      </span>
      <div
        className={cx(
          'hg-drop hg-drop--row',
          over && !p.full && 'is-over',
          error && 'is-error',
          p.full && 'is-full',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon name="paperclip" />
        <p className="hg-drop__title">
          {p.drop}{' '}
          <button
            type="button"
            className="hg-btn hg-btn--link"
            aria-describedby={`${id}-h`}
            disabled={p.full}
            onClick={() => input.current?.click()}
          >
            {p.pick}
          </button>
        </p>
        <input
          ref={input}
          type="file"
          accept={p.accept}
          multiple={p.multiple}
          hidden
          aria-labelledby={`${id}-l`}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      <p className="hg-help" id={`${id}-h`} style={{ margin: 0 }}>
        {p.help}
      </p>
      {error && (
        <p className="hg-help is-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      {p.files.length > 0 && (
        <ul className="hg-files" aria-labelledby={`${id}-l`}>
          {p.files.map((f) => (
            <li key={f.key} className={cx('hg-file', f.error && 'is-error')}>
              <span className="hg-file__thumb" aria-hidden="true">
                {f.thumb ? <img src={f.thumb} alt="" /> : <Icon name="image" />}
              </span>
              <span className="hg-file__text">
                <span className="hg-file__name">{f.name}</span>
                {f.error ? (
                  <span className="hg-file__sub">
                    <Icon name="circle-alert" />
                    {f.error}
                    {f.onRetry && (
                      <button type="button" className="hg-btn hg-btn--link" onClick={f.onRetry}>
                        {p.retryLabel}
                      </button>
                    )}
                  </span>
                ) : f.progress !== undefined ? (
                  <>
                    <span className="hg-file__sub">{p.uploadingLabel}</span>
                    <span
                      className="hg-file__bar"
                      role="progressbar"
                      aria-label={f.name}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(f.progress * 100)}
                    >
                      <i style={{ ['--p' as string]: `${Math.round(f.progress * 100)}%` }} />
                    </span>
                  </>
                ) : (
                  <span className="hg-file__sub">{f.sub}</span>
                )}
              </span>
              <button
                type="button"
                className="hg-file__remove"
                aria-label={p.removeLabel(f.name)}
                onClick={() => p.onRemove(f.key)}
              >
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
