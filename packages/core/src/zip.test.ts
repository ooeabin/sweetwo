import { describe, expect, it } from 'vitest';
import { makeZip, toCsv } from './zip';

describe('내보내기 파일', () => {
  it('CSV: BOM, 쉼표·따옴표 감싸기, 빈 값', () => {
    expect(
      toCsv(
        ['이름', '금액'],
        [
          ['청약, 통장', 1000],
          ['"큰" 대출', null],
        ],
      ),
    ).toBe('﻿이름,금액\r\n"청약, 통장",1000\r\n"""큰"" 대출",\r\n');
  });
  it('zip: 파일 수, 끝 표시, 이름', () => {
    const z = makeZip(
      [
        { name: '자산.csv', text: 'a' },
        { name: '목표.csv', text: 'bc' },
      ],
      new Date(2026, 9, 18, 6, 0, 0),
    );
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
    // ‘a’의 CRC-32
    expect(v.getUint32(14, true)).toBe(0xe8b7be43);
    expect(new TextDecoder().decode(z.slice(30, 30 + 10))).toBe('자산.csv');
  });
});
