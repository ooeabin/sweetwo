// main과 preload가 같이 쓰는 IPC 채널 이름. 채널은 여기서만 만든다.
export const CH = {
  /** main → 렌더러: 초대 링크(sweetwo://i/{code}) */
  invite: 'sweetwo:invite',
} as const;
