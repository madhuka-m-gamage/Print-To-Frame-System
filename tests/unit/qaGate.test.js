import { describe, it, expect } from 'vitest';
import { checklistWithGuardedQa, withDefectRecorded } from '../../src/utils/qaGate';

describe('checklistWithGuardedQa', () => {
  const passed = { checklist: { qaPassed: true }, qaCheck: { passed: true } };

  it('cannot set qaPassed from a save when no QA inspection is on record', () => {
    expect(checklistWithGuardedQa({ materialsCut: true, qaPassed: true }, { checklist: { qaPassed: false } })).toEqual({ materialsCut: true, qaPassed: false });
    expect(checklistWithGuardedQa({ qaPassed: true }, undefined).qaPassed).toBe(false);
  });

  it('rejects a qaPassed flag that has no qaCheck behind it', () => {
    expect(checklistWithGuardedQa({ qaPassed: true }, { checklist: { qaPassed: true } }).qaPassed).toBe(false);
  });

  it('keeps a genuine QA sign-off, and cannot be cleared by an ordinary save either', () => {
    expect(checklistWithGuardedQa({ qaPassed: false }, passed).qaPassed).toBe(true);
    expect(checklistWithGuardedQa({ qaPassed: true }, passed).qaPassed).toBe(true);
  });

  it('leaves the other milestones exactly as sent', () => {
    expect(checklistWithGuardedQa({ materialsCut: true, frameWelded: false }, passed)).toMatchObject({ materialsCut: true, frameWelded: false });
  });
});

describe('withDefectRecorded', () => {
  it('sets the active defect and appends it to history without losing earlier ones', () => {
    const first = { id: 'DEF-1', category: 'Warped' };
    const second = { id: 'DEF-2', category: 'Weld' };
    const a = withDefectRecorded({}, first);
    expect(a).toEqual({ defectDetails: first, defectHistory: [first] });
    const b = withDefectRecorded({ defectHistory: a.defectHistory }, second);
    expect(b.defectDetails).toBe(second);
    expect(b.defectHistory).toEqual([first, second]);
  });
});
