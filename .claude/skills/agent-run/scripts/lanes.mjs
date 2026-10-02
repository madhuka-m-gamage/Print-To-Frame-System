import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const laneMinutes = (lane) => lane.reduce((sum, i) => sum + i.minutes, 0);

export function shouldStartNext(spentOutputTokens, thresholdOutputTokens) {
  return thresholdOutputTokens == null || spentOutputTokens < thresholdOutputTokens;
}

function groupItems(items) {
  const parent = new Map(items.map((i) => [i.id, i.id]));
  const find = (id) => (parent.get(id) === id ? id : find(parent.get(id)));
  const join = (a, b) => parent.set(find(a), find(b));
  const owner = new Map();
  for (const i of items) {
    for (const file of i.files) {
      if (owner.has(file)) join(i.id, owner.get(file));
      else owner.set(file, i.id);
    }
    for (const dep of i.deps) if (parent.has(dep)) join(i.id, dep);
  }
  const groups = new Map();
  for (const i of items) {
    const root = find(i.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }
  return [...groups.values()];
}

function orderByDeps(group) {
  const ids = new Set(group.map((i) => i.id));
  const done = new Set();
  const ordered = [];
  while (ordered.length < group.length) {
    const next = group.find((i) => !done.has(i.id) && i.deps.every((d) => !ids.has(d) || done.has(d)));
    if (!next) throw new Error(`dependency cycle among ${[...ids].filter((id) => !done.has(id)).join(', ')}`);
    done.add(next.id);
    ordered.push(next);
  }
  return ordered;
}

export function buildLanes(items, slots = 2) {
  const lanes = Array.from({ length: slots }, () => []);
  const groups = groupItems(items).map(orderByDeps).sort((a, b) => laneMinutes(b) - laneMinutes(a));
  for (const group of groups) {
    const target = lanes.reduce((best, lane) => (laneMinutes(lane) < laneMinutes(best) ? lane : best));
    target.push(...group);
  }
  return lanes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const items = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(buildLanes(items, Number(process.argv[3] || 2)), null, 2));
}
