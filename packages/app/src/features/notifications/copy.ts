// 알림 센터 문구(docs/spec/14-notifications.md N-01~N-03, 디자인 NotificationPanel). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  title: '알림',
  readAll: '모두 읽음',
  settings: '알림 설정',
  close: '닫기', // [확인 필요] 화면 읽기용
  back: '뒤로',
  empty: '새 알림이 없어요',
  targetDeleted: '지워진 항목이에요',
  targetHidden: '지금은 볼 수 없는 항목이에요',
  groups: { today: '오늘', week: '이번 주', earlier: '이전' },
  loadFailed: '알림을 불러오지 못했어요',
  // 14 N-01·N-02 R-08(2026-11-13): 같이 쓰는 것 변경 알림 줄 아래
  revert: '이전 값으로 돌리기', // [확인 필요]
  reverted: '이전 값으로 돌렸어요', // [확인 필요]
  revertGone: '그 뒤에 바뀌어서 돌릴 수 없어요', // [확인 필요]
  revertFailed: '돌리지 못했어요. 다시 시도해 주세요', // [확인 필요]
  retry: '다시 시도',
  offline: '연결되면 새 알림을 받아요',
  unread: '새 알림', // [확인 필요] 화면 읽기용
};
