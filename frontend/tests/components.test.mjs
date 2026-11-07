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

test('project list in NavigationRail uses semantic ul/li structure without invalid ARIA role', () => {
  const railCode = readFileSync(
    resolve(__dirname, '../src/components/NavigationRail.tsx'),
    'utf-8'
  );
  // Must use native semantic ul and li tags
  assert.match(railCode, /<ul className="project-list"/);
  assert.match(railCode, /<li key={p\.id}>/);
  // Must NOT use role="list" which triggers aria-required-children in axe-core
  assert.doesNotMatch(railCode, /role="list"/);
  // Must indicate active project with aria-current
  assert.match(railCode, /aria-current=\{p\.id === projectId \? "true" : undefined\}/);
  // Must render empty state when projects list is empty
  assert.match(railCode, /rail-empty/);
  // Must render pagination outside ul list
  assert.match(railCode, /load-more-rail/);
});

test('SourceModal maintains coherent capture title, content and origin identity', () => {
  const modalCode = readFileSync(
    resolve(__dirname, '../src/components/SourceModal.tsx'),
    'utf-8'
  );
  const appCode = readFileSync(
    resolve(__dirname, '../src/App.tsx'),
    'utf-8'
  );
  // Verifies useEffect synchronizes title and text on capture change
  assert.match(modalCode, /setTitle\(capture\.title\)/);
  assert.match(modalCode, /setContent\(capture\.text\)/);
  // Verifies originUrl and capture.id are explicitly passed on save
  assert.match(modalCode, /originUrl/);
  assert.match(modalCode, /capture\?\.id/);
  // Verifies App.tsx mounts SourceModal with key to cleanly reset on new capture ID
  assert.match(appCode, /key=\{capture\?\.id \?\? "source-manual"\}/);
});
