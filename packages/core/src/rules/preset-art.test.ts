import { describe, expect, it } from 'vitest';
import { goalPhotoChoices, goalPhotoPresets, goalPreset } from './preset-art';

describe('지정 그림', () => {
  it('목표 종류마다 1장, 예전에 고른 없는 사진이면 기본', () => {
    expect(goalPhotoPresets('travel')).toEqual(['travel-01']);
    expect(goalPreset({ template: 'travel', photo_preset: null })).toBe('travel-01');
    expect(goalPreset({ template: 'travel', photo_preset: 'travel-03' })).toBe('travel-01');
  });
  it('직접 만든 목표는 지정 사진 없음(올리기만)', () => {
    expect(goalPhotoChoices('custom')).toEqual([]);
    expect(goalPreset({ template: 'custom', photo_preset: null })).toBeNull();
  });
});
