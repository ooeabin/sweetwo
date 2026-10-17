import { fetchMe, fetchPartner, fetchSpace, qk } from '@sweetwo/api';
import { coupleOf } from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';

// 설정 화면 공통 값: 나, 공간, 배우자, 두 사람 이름
export function useSettingsData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const loading = me.isLoading || space.isLoading || partner.isLoading;
  const c = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  return {
    loading,
    me: me.data ?? null,
    space: space.data ?? null,
    partner: partner.data ?? null,
    c,
  };
}
