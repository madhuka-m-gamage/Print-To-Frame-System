import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Workflow scripts start with `export const meta` and may `return` at top level, so parse the
// body as an async function after dropping the `export` keyword.
export function checkWorkflow(source) {
  if (!/^export const meta = \{/m.test(source)) throw new Error('script must start with export const meta = {...}');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  new AsyncFunction(source.replace(/^export const meta/m, 'const meta'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkWorkflow(readFileSync(process.argv[2], 'utf8'));
  console.log('workflow script parses');
}
