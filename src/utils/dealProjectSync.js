const PROJECT_STATUS_BY_DEAL_STAGE = {
  Fabricating: 'Ongoing',
  'Ready To Load': 'Ready For Inspection',
  Completed: 'Completed',
};

const PROJECT_ORDER = ['Pending', 'Ongoing', 'Ready For Inspection', 'Revision', 'Completed'];

// The deal stage is the source of truth, but the sync only moves a project forward: a job that
// already passed QA (or was sent to Revision) is never pulled back by a slower deal card.
export function projectStatusForDealStage(dealStage, currentStatus) {
  const target = PROJECT_STATUS_BY_DEAL_STAGE[dealStage];
  if (!target) return null;
  const current = PROJECT_ORDER.indexOf(currentStatus);
  if (current === -1) return null;
  return current < PROJECT_ORDER.indexOf(target) ? target : null;
}
