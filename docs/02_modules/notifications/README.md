# Notifications

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate.

## Files and folders

- `src/components/dashboard/NotificationsView.jsx`: the feed UI (lazy-loaded in `App.jsx`). Filters ALL / SYSTEM / MESSAGES plus a search box.
- `src/shared/utils/events.js`: `emitNotification` and `subscribeToNotifications`, built on a module-level `EventTarget`.
- `src/shared/utils/toast.js`: wraps Sonner toasts **and also calls `emitNotification`**; 23 files import it.
- `src/App.jsx`: notification state (`notificationsList`, `unreadNotificationsCount`), browser `Notification` helpers (`triggerBrowserNotification`, permission requested at startup), sidebar and header bell badges, `notifications` in the restricted-role tab list.
- `src/context/MessagingContext.jsx`: supplies direct-message items to the feed.
- `src/context/PermissionsContext.jsx` and `PermissionsManager.jsx`: `notifications` permission is full for every role.

## Firestore collections read/written

**System notifications are not persisted.** They live in `useState` and are lost on reload; `NotificationsView.jsx` has no Firestore imports. The only persisted part of the feed is the message half: `MessagingContext.jsx` reads `messages` and writes `readBy` (see [internal-messaging.md](../internal-messaging/README.md)).

## Cloud Functions / triggers

No Cloud Functions, FCM, service worker or server push (`public/` has no service worker).

- **Producers:** (1) every `toast.success / error / info / warning` and `showToast` call also emits a feed entry (main producer, across 23 files, e.g. invoice and receipt toasts in `App.jsx`); (2) an explicit `commission` notification ("Commission Eligible: Full Payment Cleared") from `App.jsx` when a referred lead's invoices are fully paid.
- **Channels:** in-app list; Sonner toast (plus a custom chat toast); browser `Notification` API for **new chat messages only**. Email and WhatsApp are not notification channels here; `mailer` / `api/send-email.js` and `wa.me` links are used only for manual sends.
- **Read / unread:** system items get `read: false` but that flag is never read. The real indicator is `unreadNotificationsCount`, incremented per event and reset to 0 when the bell or sidebar item is clicked. There is no per-item read state; "Clear all" and delete just empty the array. Messages have real per-user read tracking (`readBy`).

## Depends on / called by

MessagingContext (messages, `openMiniChat`, `markAllAsRead`), PermissionsContext, Sonner and `shared/utils/toast` (every module that toasts), `shared/ui` (`PageHeader`, `FilterBar`, `StatusBadge`, `UserAvatar`), `shared/utils/dateUtils`, invoice / lead / partner data in `App.jsx` (commission event), the users list.

## Summary

Notifications are an in-memory, session-only feed on a browser `EventTarget` bus. `App.jsx` subscribes and keeps an array and an unread counter for the bell and sidebar badge. Most toasts become feed entries automatically. `NotificationsView` shows the ephemeral system alerts with the last 30 direct messages from Firestore.

## Open questions

- Because feed entries are session-only, a business event (e.g. commission eligibility) is visible only to the user whose browser fired it, and only until reload. Nobody else is notified.
