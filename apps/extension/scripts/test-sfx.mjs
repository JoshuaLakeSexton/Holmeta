#!/usr/bin/env node
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const sfxDir = path.resolve(process.cwd(), 'src/assets/sfx');
const expected = [
  'hm_hover_01.ogg','hm_hover_02.ogg','hm_click_01.ogg','hm_click_02.ogg',
  'hm_toggle_on.ogg','hm_toggle_off.ogg','hm_save.ogg','hm_success.ogg','hm_warn.ogg','hm_error.ogg','hm_test_ping.ogg',
  'hm_focus_start.ogg','hm_focus_end.ogg','hm_eye.ogg','hm_move.ogg','hm_water.ogg','hm_breath_in.ogg','hm_breath_out.ogg'
];

const minBytes = 512;

async function main() {
  const entries = await readdir(sfxDir);
  const missing = expected.filter((name) => !entries.includes(name));
  if (missing.length) {
    throw new Error(`Missing SFX files: ${missing.join(', ')}`);
  }

  const tooSmall = [];
  for (const name of expected) {
    const s = await stat(path.join(sfxDir, name));
    if (!s.isFile() || s.size < minBytes) {
      tooSmall.push(`${name} (${s.size} bytes)`);
    }
  }

  if (tooSmall.length) {
    throw new Error(`Invalid SFX assets (too small/empty): ${tooSmall.join(', ')}`);
  }

  console.log(`SFX asset tests passed (${expected.length} files, >= ${minBytes} bytes each).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
