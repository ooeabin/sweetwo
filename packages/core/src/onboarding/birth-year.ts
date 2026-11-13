import { todayKst } from '../date';

/** 생년월일 휠 범위: 1950년 ~ (올해 − 18)년(O-13, P-04, S-11i) */
export const birthYearRange = (now = new Date()) => ({
  min: 1950,
  max: Number(todayKst(now).slice(0, 4)) - 18,
});
