# Internal Messaging

> Module map. Source: Phase 3 mapping pass (read-only). Line numbers are approximate. Rules details from the pass; verify against `firestore.rules` before relying on them.

## Files and folders

- `src/context/MessagingContext.jsx`: `MessagingProvider` (wraps the app), `useMessaging`, `getChannelId`.
- `src/components/tools/Messages.jsx`: full-page chat (lazy-loaded; tab `messages`).
- `src/components/tools/MiniChatDrawer.jsx`: floating chat drawer.
- `src/components/common/FloatingMessageToast.jsx`: incoming-message toast with quick reply.
- `src/App.jsx`: `MessagesNavLink` (sidebar badge from `totalUnreadCount`), mobile nav buttons, provider mount.
- `src/components/dashboard/NotificationsView.jsx`: shows messages as notification items.
- `src/services/firestoreSync.js`: `COLLECTIONS.MESSAGES`, `TYPING_INDICATORS`. `PermissionsManager.jsx` / `PermissionsContext.jsx`: `messages` permission. `firestore.rules` (messages and typing_indicators blocks).

## Firestore collections read/written

- `messages`: flat collection, one document per message, id `msg_<ts>_<rand>`. Fields: `channelId` (two lowercased user ids sorted and joined with `_`), `participants` `[me, target]`, `fromId`, `toId`, `senderName`, `text`, `timestamp` (ms number), `readBy` (array of user ids, starts as `[sender]`), `replyTo` (`{id, text, fromId}` or null). Ids are lowercased emails.
- **No thread / conversation document.** A conversation is the set of messages sharing a `channelId`, derived client-side. One `onSnapshot` on `messages` with `where('participants', 'array-contains', myId)`.
- **Unread counts:** computed client-side (messages from the other user whose `readBy` lacks me, grouped by sender). **Read receipts:** `markChatAsRead` / `markAllAsRead` append my id to `readBy` via `updateDocument`.
- `typing_indicators`: one document per user (id = user id) with `fromId`, `channelId`, `isTyping`, `timestamp`, written with merge on input change; read by a whole-collection `onSnapshot`; only entries under 3 seconds old count.
- Rules (from the pass): `messages` read and create for any authenticated user; update by Admin, the original sender, or a participant changing only `readBy`; delete by Admin or the sender within 15 minutes. `typing_indicators` read / write for any authenticated user.
- No edit or delete UI was found in the context or `Messages.jsx`.

## Cloud Functions / triggers

No Cloud Functions. Client-side effects: a toast for an unread incoming message (suppressed if that chat is open); a browser `Notification` (tag `chat-message`) via `triggerBrowserNotification` from `App.jsx`; the sidebar badge. Not found: audit log, server-side email or push (`api/` has only `generate.js` for AI).

**Who can message whom:** gated only by the `messages` permission (`canAccess(role, 'messages')`). Defaults: `full()` for most roles and Customer; `Partner` has `none()` (and the Partner route guard limits them to dashboard, notifications, partners, profile). The contact list is every approved user, filtered only by search / unread. No per-recipient role restriction; the Firestore rules do not check the `messages` permission.

## Depends on / called by

`PermissionsContext`, the `users` collection (via `App.jsx`), `firestoreSync` (`addDocument`, `updateDocument`, `setDocument`), `services/firebase`, `triggerBrowserNotification` (from `App.jsx`), `shared/utils/toast`, `shared/ui`. Consumed by `NotificationsView`.

## Summary

Firestore-only 1-on-1 direct chat provided by a root `MessagingProvider`. Each message carries a deterministic `channelId` and a `participants` array; unread state lives in each message's `readBy`; typing status is a per-user document. Incoming messages trigger a toast and a browser notification. There is no server-side, email, push or audit involvement.

## Open questions

- Confirmed in `firestore.rules`: any authenticated user can read all `messages` documents (reads are not restricted to participants), even though the client filters by `participants`; see [FIRESTORE_RULES_NOTES.md](../../03_security/FIRESTORE_RULES_NOTES.md).
- The whole-collection `typing_indicators` listener reads every user's indicator.
