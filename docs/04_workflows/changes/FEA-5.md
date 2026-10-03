## Changelog
- FEA-5: Fabrication sends a stored revision alert (`type: 'revision'`, defect category and notes) to the linked deal's `salesOwnerEmail` when a job goes to Revision, and Completed cards get an "Email client: QA passed" button that previews and sends `fabrication_ready_inspection` (now the ninth entry of `SENDABLE_TEMPLATES` in `api/send-email.js`, staff only). Lead conversion stamps `salesOwnerEmail` on the new deal. Tests: API 84, component 226.

## Testing map
- `api/send-email.js` row: nine allowed templates (FEA-5 added `fabrication_ready_inspection`; refused for Partner, Business Client, Customer).
- `FabricationWorks` row: revision alert to the deal sales owner (and the no-owner and no-deal cases), QA-passed email preview, send, failure and no-address cases.

## Status
done; tests: unit 336, API 84, component 226, rules 0, e2e 0
