// TanStack Query 키는 여기에만 모은다.
export const qk = {
  monthClose: (spaceId: string, month: string) => ['month_close', spaceId, month] as const,
  goals: (spaceId: string) => ['goal', spaceId] as const,
};
