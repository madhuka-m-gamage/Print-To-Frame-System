## Changelog
- FEA-7: plain `toast.*` calls no longer add entries to the notification centre; a toast passed `{ notify: true }` is stored as a `notifications` document for the signed-in user (used for "deal fully settled"), the session-only feed entry and counter are removed, the message feed shows only unread messages so "Mark Messages Read" clears it, `commission` gets its own icon and badge, and the dead `showToast` and obfuscated `oT()`/`uT()` helpers are gone. Tests: component +5 (new `App.notifyPersist.test.jsx`, `NotificationsView.test.jsx` +2), two existing component tests adjusted.

## Testing map
- Notifications row in the coverage map: add `tests/component/App.notifyPersist.test.jsx` (toast to notification, notify option) and the NotificationsView read-message and commission cases.

## Status
done; tests: unit 0, API 0, component +5, rules 0, e2e 0
