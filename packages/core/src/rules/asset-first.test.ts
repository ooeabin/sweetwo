import { describe, expect, it } from 'vitest';
import { assetGroup } from './asset';
import { assetOwnership, assetTileHint, firstAssetChips, type AssetCountItem } from './asset-first';

const row = (o: Partial<AssetCountItem>): AssetCountItem => ({
  side: 'asset',
  owner: 'person',
  owner_user_id: 'me',
  created_by: 'me',
  ...o,
});

describe('홈 자산 관리 타일 문구(2026-11-18)', () => {
  it('내 자산이 있으면 순자산 값', () => {
    expect(assetTileHint({ together: true, mine: 1, partner: 3 })).toBe('value');
    expect(assetTileHint({ together: false, mine: 2, partner: 0 })).toBe('value');
  });
  it('둘이고 내 것은 없고 파트너가 적었으면 파트너 소식(궁금함보다 먼저)', () => {
    expect(assetTileHint({ together: true, mine: 0, partner: 1 })).toBe('partner');
  });
  it('둘인데 아무도 안 적었거나 파트너가 숨겼으면(개수 0) 우리 둘 궁금함', () => {
    expect(assetTileHint({ together: true, mine: 0, partner: 0 })).toBe('ask-two');
  });
  it('혼자 쓰기·미합류는 내 순자산 궁금함, 파트너 개수는 무시', () => {
    expect(assetTileHint({ together: false, mine: 0, partner: 0 })).toBe('ask-me');
    expect(assetTileHint({ together: false, mine: 0, partner: 2 })).toBe('ask-me');
  });
});

describe('내 것·파트너 개수', () => {
  it('내 명의, 공동, 내가 대신 입력한 것은 내 것', () => {
    const items = [
      row({}),
      row({ owner: 'joint', owner_user_id: null, created_by: 'p' }),
      row({ owner_user_id: null, created_by: 'me' }),
    ];
    expect(assetOwnership(items, [], 'me')).toEqual({ mine: 3, partner: 0 });
  });
  it('파트너 ‘모두’ 행 + ‘총액만’ 묶음 개수를 더하고 부채는 세지 않음', () => {
    const items = [
      row({ owner_user_id: 'p', created_by: 'p' }),
      row({ owner_user_id: 'p', created_by: 'p', side: 'debt' }),
    ];
    const sums = [
      { side: 'asset' as const, n: 2 },
      { side: 'debt' as const, n: 5 },
    ];
    expect(assetOwnership(items, sums, 'me')).toEqual({ mine: 0, partner: 3 });
  });
  it('아무것도 없으면 0', () => {
    expect(assetOwnership([], [], 'me')).toEqual({ mine: 0, partner: 0 });
  });
});

describe('F-02 종류 칩', () => {
  it('여섯 개, 묶음·종류 키가 자산 종류 표에 있음', () => {
    expect(firstAssetChips.map((c) => c.key)).toEqual([
      'bank',
      'savings',
      'stock',
      'jeonse',
      'car',
      'loan',
    ]);
    for (const c of firstAssetChips) {
      const g = assetGroup(c.grp);
      expect(g?.side).toBe(c.side);
      expect(g?.kinds.map((k) => k.key)).toContain(c.kind);
    }
  });
});
