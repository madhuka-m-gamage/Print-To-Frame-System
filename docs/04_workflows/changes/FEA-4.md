## Changelog
- FEA-4: the logistics driver and vehicle pickers read `settings/fleet` (Admin edits it in the Admin panel, Fleet & Drivers tab) and fall back to the built-in lists when it is missing; new `settings/fleet` rules block (read: logistics view, write: Admin), not yet deployed. Tests: component +7, rules +10.

## Testing map
- Rules coverage: add `settings/fleet` (Admin write, logistics-view read, signed-out denied) to `tests/integration/settingsFleet.test.js`.
- Component coverage: add `FleetDirectoryEditor` (`tests/component/FleetDirectoryEditor.test.jsx`) and the fleet-picker cases in `Logistics.test.jsx` and `LogisticsCardDetails.test.jsx`.
- `tests/helpers/setupComponent.js` now answers `settings/fleet` from `globalThis.__TEST_FLEET__`.

## Status
open: rules deploy (`firebase deploy --only firestore:rules`) is a live action; tests: unit 0, API 0, component +7, rules +10, e2e 0
