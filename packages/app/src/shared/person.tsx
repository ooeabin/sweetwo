// 사람 첫 글자 원(Avatar). 시작한 사람 1, 합류한 사람 2(누가 보든 같음)
export function PersonDot({ name, starter }: { name: string; starter: boolean }) {
  return (
    <span className={`hg-avatar ${starter ? 'hg-avatar--p1' : 'hg-avatar--p2'}`} aria-hidden="true">
      {[...name][0] ?? ''}
    </span>
  );
}
