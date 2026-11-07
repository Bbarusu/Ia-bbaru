import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('canonical KInfo tokens are defined', () => {
  const css = readFileSync(resolve(__dirname, '../src/tokens.css'), 'utf-8');
  assert.match(css, /--background:\s*#000000;/);
  assert.match(css, /--surface:\s*#0b0c0e;/);
  assert.match(css, /--border:\s*#202226;/);
  assert.match(css, /--text:\s*#e6e8ec;/);
  assert.match(css, /--text-muted:\s*#a3aab7;/);
  assert.match(css, /--accent:\s*#397ff2;/);
  assert.match(css, /--radius-card:\s*12px;/);
  assert.match(css, /--radius-panel:\s*16px;/);
});

test('accessibility rules are maintained in CSS', () => {
  const css = readFileSync(resolve(__dirname, '../src/style.css'), 'utf-8');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.sr-only/);
});
