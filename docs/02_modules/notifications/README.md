# Notifications

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

- `src/features/dashboard/NotificationsView.jsx`: the feed UI (lazy-loaded in `App.jsx`). Filters ALL / SYSTEM / MESSAGES plus a search box.
- `src/shared/utils/events.js`: `emitNotification` and `subscribeToNotifications`, built on a module-level `EventTarget`.
- `src/shared/utils/toast.js`: wraps Sonner toasts and calls `emitNotification` only when a toast passes `notify: true` (FEA-7); 23 files import it.
- `src/App.jsx`: notification state (`notificationsList`, `unreadNotificationsCount`), browser `Notification` helpers (`triggerBrowserNotification`, permission requested at startup), sidebar and header bell badges, `notifications` in the restricted-role tab list.
- `src/features/messaging/MessagingContext.jsx`: supplies direct-message items to the feed.
- `src/context/PermissionsContext.jsx` and `PermissionsManager.jsx`: `notifications` permission is full for every role.

## Firestore collections read/written

**System notifications are not persisted.** They live in `useState` and are lost on reload; `NotificationsView.jsx` has no Firestore imports. The only persisted part of the feed is the message half: `MessagingContext.jsx` reads `messages` and writes `readBy` (see [internal-messaging.md](../internal-messaging/README.md)).

## Cloud Functions / triggers

No Cloud Functions, FCM, service worker or server push (`public/` has no service worker).

- **Producers:** (1) a `toast.*` call with `notify: true` (only the "deal fully settled" toast in `App.jsx` so far), stored as a `notifications` document for the signed-in user; (2) an explicit `commission` notification ("Commission Eligible: Full Payment Cleared") from `App.jsx` when a referred lead's invoices are fully paid.
- **Channels:** in-app list; Sonner toast (plus a custom chat toast); browser `Notification` API for **new chat messages only**. Email and WhatsApp are not notification channels here; `mailer` / `api/send-email.js` and `wa.me` links are used only for manual sends.
- **Read / unread:** system items get `read: false` but that flag is never read. The real indicator is `unreadNotificationsCount`, incremented per event and reset to 0 when the bell or sidebar item is clicked. There is no per-item read state; "Clear all" and delete just empty the array. Messages have real per-user read tracking (`readBy`).

## Depends on / called by

MessagingContext (messages, `openMiniChat`, `markAllAsRead`), PermissionsContext, Sonner and `shared/utils/toast` (every module that toasts), `shared/ui` (`PageHeader`, `FilterBar`, `StatusBadge`, `UserAvatar`), `shared/utils/dateUtils`, invoice / lead / partner data in `App.jsx` (commission event), the users list.

## Summary

Notifications are persisted `notifications` documents (FEA-2, FEA-7) read back per user by `App.jsx`, which derives the bell and sidebar badge from the unread ones. A toast reaches the feed only with `notify: true`, over a browser `EventTarget` bus. `NotificationsView` shows the system alerts with the user's last 30 unread direct messages from Firestore.

## Open questions

- Because feed entries are session-only, a business event (e.g. commission eligibility) is visible only to the user whose browser fired it, and only until reload. Nobody else is notified.
