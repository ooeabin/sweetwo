import { fetchGoals, fetchMe, fetchPartner, fetchSpace, qk } from '@sweetwo/api';
import { useQuery } from '@tanstack/react-query';

// 목표 화면 기본 쿼리(키는 qk라 다른 기능과 캐시를 같이 씀)
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: fetchMe });
export const useSpace = () => useQuery({ queryKey: qk.space, queryFn: fetchSpace });
export const usePartner = () => useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
export const useGoalsList = () => useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
