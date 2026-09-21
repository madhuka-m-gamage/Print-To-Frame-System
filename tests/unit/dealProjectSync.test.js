import { describe, it, expect } from 'vitest';
import { projectStatusForDealStage } from '@/features/deals/dealProjectSync';

describe('projectStatusForDealStage', () => {
  it('moves a project forward to match the deal stage', () => {
    expect(projectStatusForDealStage('Fabricating', 'Pending')).toBe('Ongoing');
    expect(projectStatusForDealStage('Ready To Load', 'Ongoing')).toBe('Ready For Inspection');
    expect(projectStatusForDealStage('Completed', 'Ready For Inspection')).toBe('Completed');
  });

  it('never pulls a project back, even when the deal card lags behind', () => {
    expect(projectStatusForDealStage('Fabricating', 'Completed')).toBeNull();
    expect(projectStatusForDealStage('Ready To Load', 'Completed')).toBeNull();
    expect(projectStatusForDealStage('Fabricating', 'Ready For Inspection')).toBeNull();
  });

  it('leaves a project in Revision alone until the deal completes', () => {
    expect(projectStatusForDealStage('Ready To Load', 'Revision')).toBeNull();
    expect(projectStatusForDealStage('Completed', 'Revision')).toBe('Completed');
  });

  it('ignores deal stages that do not map to a project status and unknown project statuses', () => {
    expect(projectStatusForDealStage('Waiting', 'Pending')).toBeNull();
    expect(projectStatusForDealStage('Hand Over', 'Ongoing')).toBeNull();
    expect(projectStatusForDealStage('Fabricating', 'Cancelled')).toBeNull();
    expect(projectStatusForDealStage('Fabricating', undefined)).toBeNull();
  });
});
