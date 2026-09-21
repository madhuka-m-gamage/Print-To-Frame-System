import fs from 'node:fs';
import path from 'node:path';

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return ['node_modules', '.git', 'dist', 'coverage', 'test-results'].includes(e.name) ? [] : walk(p);
  return e.name.endsWith('.md') ? [p] : [];
});

let broken = 0;
for (const file of walk('.')) {
  // Links quoted inside code (fences or inline spans) are examples, not links.
  const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of text.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target) || target.includes('<')) continue;
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
      console.log(`${file}: broken link ${target}`);
      broken += 1;
    }
  }
}
console.log(broken ? `${broken} broken link(s)` : 'all markdown links resolve');
process.exit(broken ? 1 : 0);
