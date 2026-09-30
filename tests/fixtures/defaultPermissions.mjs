import { readFileSync } from 'node:fs';

// DEFAULT_PERMISSIONS lives in a .jsx file that imports the real Firebase client, so it cannot
// be imported from Node. Evaluate just its definition from the source to avoid a stale copy.
export function loadDefaultPermissions() {
  const src = readFileSync(new URL('../../src/context/PermissionsContext.jsx', import.meta.url), 'utf8');
  const start = src.indexOf('const full = ');
  const end = src.indexOf('// ── Migration helper');
  if (start < 0 || end < 0) throw new Error('Could not locate DEFAULT_PERMISSIONS in PermissionsContext.jsx');
  const body = src.slice(start, end).replace('export const DEFAULT_PERMISSIONS', 'const DEFAULT_PERMISSIONS');
  return new Function(`${body}\nreturn DEFAULT_PERMISSIONS;`)();
}
