// The QA sign-off (checklist.qaPassed) may only be set by the QA Inspection Gate, which also
// records qaCheck. Any other save (the fabrication card, a bulk update) keeps the stored value.
export function checklistWithGuardedQa(checklist = {}, existingJob) {
  const qaOnRecord = !!(existingJob?.checklist?.qaPassed && existingJob?.qaCheck?.passed);
  return { ...checklist, qaPassed: qaOnRecord };
}

// The active defect is replaced by each new one, but every defect is kept in history.
export function withDefectRecorded(job, defect) {
  return {
    defectDetails: defect,
    defectHistory: [...(job.defectHistory || []), defect],
  };
}
