import { app, dialog, type BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

// 이미지 공유(W-01 영수증 ‘공유하기’, docs/spec/20-salary-plan.md, 2026-11-09). 데스크톱은 저장 창으로 PNG 저장.
// 렌더러가 준 값은 검사: 파일 이름은 영문·숫자·.-_ 와 .png만, 내용은 PNG(머리 8바이트), 10MB까지.

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const ShareImage = z.object({
  name: z.string().regex(/^[\w.-]{1,80}\.png$/),
  base64: z.string().max(14 * 1024 * 1024),
});

/** base64 → PNG 바이트(PNG가 아니거나 10MB가 넘으면 null) */
export function pngBytes(base64: string): Buffer | null {
  const b = Buffer.from(base64, 'base64');
  if (b.length < PNG.length || b.length > 10 * 1024 * 1024) return null;
  return PNG.every((x, i) => b[i] === x) ? b : null;
}

export async function saveImage(
  f: z.infer<typeof ShareImage>,
  win: BrowserWindow | null,
): Promise<'saved' | 'cancelled'> {
  const bytes = pngBytes(f.base64);
  if (!bytes) throw new Error('not_png');
  const opts = {
    defaultPath: join(app.getPath('downloads'), f.name),
    filters: [{ name: 'PNG', extensions: ['png'] }],
  };
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  if (r.canceled || !r.filePath) return 'cancelled';
  await writeFile(r.filePath, bytes);
  return 'saved';
}
