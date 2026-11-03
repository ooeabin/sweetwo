import { describe, expect, it } from 'vitest';
import {
  avatarPresets,
  goalPhotoChoices,
  goalPhotoPresets,
  goalPreset,
} from './preset-art';

describe('지정 그림', () => {
  it('지정 아바타는 a01~a07(DB 모양 ^a[0-9]{2}$)', () => {
    expect(avatarPresets).toHaveLength(7);
    expect(avatarPresets[0]).toBe('a01');
    expect(avatarPresets.every((p) => /^a[0-9]{2}$/.test(p))).toBe(true);
  });
  it('목표 종류마다 3장, 고른 게 없으면 1번', () => {
    expect(goalPhotoPresets('travel')).toEqual(['travel-01', 'travel-02', 'travel-03']);
    expect(goalPreset({ template: 'travel', photo_preset: null })).toBe('travel-01');
    expect(goalPreset({ template: 'travel', photo_preset: 'travel-03' })).toBe('travel-03');
  });
  it('직접 만든 목표는 기본 1장 + 다른 종류 사진', () => {
    const c = goalPhotoChoices('custom');
    expect(c[0]).toBe('custom-01');
    expect(c).toContain('home-02');
    expect(c.every((p) => /^[a-z_]{2,40}-[0-9]{2}$/.test(p))).toBe(true);
  });
});
