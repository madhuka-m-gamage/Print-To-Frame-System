import { describe, it, expect } from 'vitest';
import { buildLanes, laneMinutes, shouldStartNext } from '../../.claude/skills/agent-run/scripts/lanes.mjs';

const item = (id, minutes, files = [], deps = []) => ({ id, minutes, files, deps });
const ids = (lanes) => lanes.map((lane) => lane.map((i) => i.id));

describe('agent-run lanes', () => {
  it('keeps items that share a file in one lane, in input order', () => {
    const lanes = buildLanes([item('A', 20, ['src/App.jsx']), item('B', 10, ['x.js']), item('C', 15, ['src/App.jsx'])]);
    const withA = lanes.find((lane) => lane.some((i) => i.id === 'A'));
    expect(withA.map((i) => i.id)).toEqual(['A', 'C']);
  });

  it('puts a dependent item after its dependency in the same lane', () => {
    const lanes = buildLanes([item('B', 10, ['b.js'], ['A']), item('A', 10, ['a.js'])]);
    const lane = lanes.find((l) => l.some((i) => i.id === 'B'));
    expect(lane.map((i) => i.id)).toEqual(['A', 'B']);
  });

  it('schedules an item whose dependency is outside the batch', () => {
    expect(ids(buildLanes([item('A', 10, [], ['MON-1'])])).flat()).toEqual(['A']);
  });

  it('balances groups so lane minutes stay within 20 percent', () => {
    const lanes = buildLanes([item('A', 30), item('B', 25), item('C', 20), item('D', 15), item('E', 10)]);
    const [a, b] = lanes.map(laneMinutes).sort((x, y) => y - x);
    expect((a - b) / a).toBeLessThanOrEqual(0.2);
  });

  it('never drops or duplicates an item when groups chain', () => {
    const input = [item('A', 5, ['1']), item('B', 5, ['1', '2']), item('C', 5, ['2', '3']), item('D', 5, ['4'], ['C']), item('E', 5)];
    const out = ids(buildLanes(input)).flat().sort();
    expect(out).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('builds 4 lanes for two workflows, keeping same-file items together', () => {
    const lanes = buildLanes([item('A', 20, ['firestore.rules']), item('B', 15, ['firestore.rules']), item('C', 12, ['x.js']), item('D', 10, ['y.js']), item('E', 9, ['z.js'])], 4);
    expect(lanes).toHaveLength(4);
    expect(lanes.find((l) => l.some((i) => i.id === 'A')).map((i) => i.id)).toEqual(['A', 'B']);
    expect(ids(lanes).flat().sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('returns exactly `slots` lanes, empty ones included', () => {
    expect(buildLanes([item('A', 5)], 2)).toHaveLength(2);
  });

  it('stops starting new items once the output-token threshold is reached', () => {
    expect(shouldStartNext(99_999, 100_000)).toBe(true);
    expect(shouldStartNext(100_000, 100_000)).toBe(false);
    expect(shouldStartNext(5, null)).toBe(true);
  });
});
