## Changelog
- **SEC-12:** `typing_indicators` rules scoped to the chat: only the indicator's own user may write or delete it (`fromId` = caller, caller in a two-entry `participants`), and only the chat's participants may read it (a document without `participants` is denied). `Messages.jsx` now writes `participants` and listens with `participants array-contains <me>` instead of the whole collection. Rules not deployed. Tests: rules +5 (`typingIndicators.test.js`), component +1 (`Messages.test.jsx`).

## Testing map
- Internal messaging, rules row: add `tests/integration/typingIndicators.test.js` (own-only write, participant-only read, participant query served, whole-collection read refused, missing `participants` denied).
- Internal messaging, component row: `Messages.test.jsx` also asserts the typing write carries `participants` and the listener filters on `participants array-contains <me>`.

## Status
done; tests: unit 312, API not run (unaffected), component 172, rules 68 (+5), e2e not run (per plan)
