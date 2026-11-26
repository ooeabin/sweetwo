import { describe, expect, it } from 'vitest';
import { formHero, lineMode, modeSettings, savingFormReady } from './form-logic';
import { formatWon } from '@sweetwo/core';

const money = (v: number) => formatWon(v);
const text = (h: ReturnType<typeof formHero>) => h.map((l) => l.map((p) => p.text).join(''));

describe('요약 문장', () => {
  it('아무것도 안 골랐으면 자리표시 문장', () => {
    expect(
      text(formHero({ name: '', amount: null, verb: '모을까요?', what: '무엇', money })),
    ).toEqual(['무엇을 매달 얼마씩', '모을까요?']);
  });
  it('이름만 고르면 금액 자리는 자리표시', () => {
    expect(
      text(formHero({ name: '여행', amount: null, verb: '모을까요?', what: '무엇', money })),
    ).toEqual(['여행에', '매달 얼마씩 모을까요?']);
  });
  it('이름과 금액이면 금액 조각만 accent', () => {
    const h = formHero({ name: ' 여행 ', amount: 300_000, verb: '모을까요?', what: '무엇', money });
    expect(text(h)).toEqual(['여행에', '매달 300,000원씩 모을까요?']);
    expect(
      h
        .flat()
        .filter((p) => p.tone === 'accent')
        .map((p) => p.text),
    ).toEqual(['300,000원']);
  });
  it('금액만 고르면 이름 자리는 무엇', () => {
    expect(text(formHero({ name: '', amount: 0, verb: '쓸까요?', what: '무엇', money }))).toEqual([
      '무엇에',
      '매달 0원씩 쓸까요?',
    ]);
  });
});

describe('어떻게 챙겨요?', () => {
  it('자동이 목록 끔보다 먼저', () => {
    expect(lineMode({ inChecklist: false, autoPay: true })).toBe('auto');
    expect(lineMode({ inChecklist: true, autoPay: false })).toBe('check');
    expect(lineMode({ inChecklist: false, autoPay: false })).toBe('off');
  });
  it('구간 값 → 줄 설정, 나가는 날은 자동일 때만', () => {
    expect(modeSettings('auto', 28)).toEqual({ inChecklist: true, autoPay: true, autoDay: 28 });
    expect(modeSettings('check', 28)).toEqual({ inChecklist: true, autoPay: false, autoDay: null });
    expect(modeSettings('off', null)).toEqual({
      inChecklist: false,
      autoPay: false,
      autoDay: null,
    });
  });
});

describe('저축·투자 추가 필수', () => {
  it('이름과 1만 원 단위 금액이 있어야 함', () => {
    expect(savingFormReady('', 100_000)).toBe(false);
    expect(savingFormReady('여행', null)).toBe(false);
    expect(savingFormReady('여행', 15_000)).toBe(false);
    expect(savingFormReady('여행', 0)).toBe(true);
    expect(savingFormReady('여행', 300_000)).toBe(true);
  });
});
