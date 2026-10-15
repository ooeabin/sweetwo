import { readWon, type Won } from '@sweetwo/core';
import { create } from 'zustand';

// 금액 가리기(눈 버튼, 검색 ‘금액 가리기’). 기기마다 기억(서버 없음). 저장소가 막혀 있으면 이번 실행에서만.
const KEY = 'sweetwo.masked';
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const useMask = create<{ masked: boolean; toggle: () => void }>((set, get) => ({
  masked: read(),
  toggle: () => {
    const masked = !get().masked;
    try {
      localStorage.setItem(KEY, masked ? '1' : '0');
    } catch {
      /* 저장 못 해도 화면에는 적용 */
    }
    set({ masked });
  },
}));

export const MASKED = '•••';
/** 금액 표기(가리기 켜면 •••) */
export const money = (v: Won, masked: boolean) => (masked ? MASKED : readWon(v));
