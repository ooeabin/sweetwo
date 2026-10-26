// 이름 뒤 조사(은/는). 받침이 있으면 ‘은’, 없으면 ‘는’. 한글이 아니면 ‘는’.
export function topic(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}는`;
  return `${word}${code % 28 ? '은' : '는'}`;
}

/** 목적격(을/를). 받침이 있으면 ‘을’, 없으면 ‘를’. 한글이 아니면 ‘를’ */
export function object(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}를`;
  return `${word}${code % 28 ? '을' : '를'}`;
}

/** 접속(와/과). 받침이 있으면 ‘과’, 없으면 ‘와’. 한글이 아니면 ‘와’ */
export function withAnd(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}와`;
  return `${word}${code % 28 ? '과' : '와'}`;
}

const hasBatchim = (word: string) => {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};

/** 주격(이/가). 서버 ko_subj와 같음. 한글이 아니면 ‘가’ */
export function subject(word: string): string {
  return `${word}${hasBatchim(word) ? '이' : '가'}`;
}

/** 서술(이에요/예요). 서버 ko_is와 같음. 한글이 아니면 ‘예요’ */
export function isWord(word: string): string {
  return `${word}${hasBatchim(word) ? '이에요' : '예요'}`;
}
