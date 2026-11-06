// 브리지 안 이벤트(로그인 결과, 잠김, 초대, 화면 이동). 받는 쪽은 돌려준 함수로 해제.
export function emitter<T>() {
  const fns = new Set<(v: T) => void>();
  return {
    on(fn: (v: T) => void) {
      fns.add(fn);
      return () => void fns.delete(fn);
    },
    emit(v: T) {
      fns.forEach((f) => f(v));
    },
  };
}
