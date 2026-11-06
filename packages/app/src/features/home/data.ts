import { fetchGoals, fetchMe, fetchPartner, fetchSpace, qk } from '@sweetwo/api';
import { useQuery } from '@tanstack/react-query';

// 홈 데이터. 키는 qk라 다른 기능과 캐시를 같이 쓴다.
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
