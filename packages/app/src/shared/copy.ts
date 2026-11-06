// 여러 기능이 같이 쓰는 공통 상태 문구(docs/spec/13-common-states.md)
export const sharedCopy = {
  /** 13 공통 상태 9번: 인터넷이 없을 때 막힌 동작 */
  needOnline: '인터넷에 연결되면 할 수 있어요',
  /** 13 공통 상태 19번(2026-11-04): 없는 주소, 지워진 항목 */
  notFoundTitle: '찾는 화면이 없어요', // [확인 필요]
  notFoundBody: '지워졌거나 주소가 바뀌었어요', // [확인 필요]
  goHome: '홈으로 가기',
  /** 13 공통 상태 7번: 화면을 그리다 문제가 생겼을 때 */
  errorTitle: '잠시 문제가 생겼어요',
  errorBody: '다시 시도해 주세요',
  retry: '다시 시도',
};
