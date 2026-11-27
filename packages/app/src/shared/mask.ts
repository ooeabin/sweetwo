import { formatWonCap, readWonCap, type Won } from '@sweetwo/core';
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
/**
 * 금액 표기(가리기 켜면 •••): “3,500,000원”(2026-11-26 원 단위 전체, 11 공통 6장). 합계가 999억 원을 넘으면 “999억+”
 * (2026-11-12 QA 8구간 S8-02: 순자산·자산 합계가 999억을 넘으면 표기가 멈추던 것)
 */
export const money = (v: Won, masked: boolean) => (masked ? MASKED : formatWonCap(v));
/** 짧은 표기 “1,600만 원”(11 공통 6장 예외 표의 좁은 자리만: 그래프 막대 위 값). 그 밖은 money */
export const moneyShort = (v: Won, masked: boolean) => (masked ? MASKED : readWonCap(v));
