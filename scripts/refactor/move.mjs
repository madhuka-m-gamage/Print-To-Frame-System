// Moves files listed in a manifest and rewrites every import (and markdown path mention) to match.
//
//   node scripts/refactor/move.mjs <manifest.json> [--dry-run]
//
// The manifest is { "src/old/File.jsx": "src/new/File.jsx", ... }. An empty {} only normalises
// imports to the house style: `./x` for the same folder or a child folder, `@/x` for anything else
// under src/. Files that cannot use the alias (Vercel functions in api/, the root config files,
// Playwright specs and node fixtures) keep relative paths. Temporary tool for the 8.2 refactor.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const [manifestPath, flag] = process.argv.slice(2);
if (!manifestPath) {
  console.error('usage: node scripts/refactor/move.mjs <manifest.json> [--dry-run]');
  process.exit(2);
}
const dryRun = flag === '--dry-run';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const EXTS = ['', '.js', '.jsx', '.mjs', '.json', '/index.js', '/index.jsx'];
const ROOT_FILES = ['vite.config.js', 'vitest.config.js', 'vitest.component.config.js', 'playwright.config.js', 'eslint.config.js'];
const SPEC = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|vi\.(?:mock|doMock|unmock|importActual)\s*\(\s*)(['"])([^'"\n]+)\2/g;

const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const skipDir = (name) => ['node_modules', '.git', 'dist', 'coverage', 'test-results'].includes(name);
const walk = (dir, test) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return skipDir(e.name) ? [] : walk(p, test);
  return test(e.name) ? [p] : [];
});
const isCode = (name) => /\.(jsx?|mjs)$/.test(name);

// Only code that Vite or Vitest processes can use the @/ alias.
const aliasOk = (relPath) => relPath.startsWith('src/') || /^tests\/(unit|component|api|integration|helpers)\//.test(relPath);

const resolveTarget = (fromFile, spec) => {
  const base = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : path.resolve(path.dirname(fromFile), spec);
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
};
const newLocation = (relPath) => manifest[relPath] || relPath;

const files = [
  ...['src', 'tests', 'api'].filter((d) => fs.existsSync(d)).flatMap((d) => walk(d, isCode)),
  ...ROOT_FILES.filter((f) => fs.existsSync(f)).map((f) => path.join(root, f)),
];

const plans = files.map((file) => {
  const oldRel = rel(file);
  const newRel = newLocation(oldRel);
  const text = fs.readFileSync(file, 'utf8');
  const out = text.replace(SPEC, (whole, lead, quote, spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) return whole;
    const target = resolveTarget(file, spec);
    if (!target) {
      console.warn(`unresolved in ${oldRel}: ${spec}`);
      return whole;
    }
    const targetRel = newLocation(rel(target));
    const hadExt = /\.(jsx?|mjs|json|css)$/.test(spec);
    const isDirImport = /\/index\.jsx?$/.test(targetRel) && !/index(\.jsx?)?$/.test(spec);
    let bare = isDirImport ? targetRel.replace(/\/index\.jsx?$/, '') : targetRel;
    if (!hadExt && !isDirImport) bare = bare.replace(/\.(jsx?|mjs)$/, '');

    const fromDir = path.posix.dirname(newRel);
    const inSameOrChildFolder = bare === fromDir || bare.startsWith(`${fromDir}/`);
    let next;
    if (aliasOk(newRel) && !inSameOrChildFolder && bare.startsWith('src/')) {
      next = `@/${bare.slice(4)}`;
    } else {
      next = path.posix.relative(fromDir, bare) || '.';
      if (!next.startsWith('.')) next = `./${next}`;
    }
    return `${lead}${quote}${next}${quote}`;
  });
  return { oldRel, newRel, out, changed: out !== text };
});

let moved = 0;
let rewritten = 0;
for (const p of plans) {
  if (p.newRel !== p.oldRel) {
    moved += 1;
    if (!dryRun) {
      fs.mkdirSync(path.dirname(p.newRel), { recursive: true });
      execFileSync('git', ['mv', p.oldRel, p.newRel]);
    }
  }
  if (p.changed) {
    rewritten += 1;
    if (!dryRun) fs.writeFileSync(p.newRel, p.out);
  }
}

// Documentation that names a moved path as text (for example `src/components/crm/Leads.jsx`).
let docsUpdated = 0;
if (!dryRun && Object.keys(manifest).length) {
  for (const md of walk('.', (name) => name.endsWith('.md'))) {
    const before = fs.readFileSync(md, 'utf8');
    let text = before;
    for (const [from, to] of Object.entries(manifest)) text = text.split(from).join(to);
    if (text !== before) {
      fs.writeFileSync(md, text);
      docsUpdated += 1;
    }
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}moved ${moved} file(s), rewrote imports in ${rewritten} file(s), updated ${docsUpdated} doc(s)`);
