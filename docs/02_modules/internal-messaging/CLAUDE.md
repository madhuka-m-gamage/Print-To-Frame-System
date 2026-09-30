# Internal Messaging: module notes for Claude

Full map: [README.md](README.md). Audit findings & open questions: [FINDINGS.md](FINDINGS.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

1-on-1 direct chat over Firestore with unread badges, read receipts (one tick sent, two ticks read), typing indicators, quoted replies, toasts, a chime and browser notifications.

## Code

- `src/features/messaging/MessagingContext.jsx` (listener, sends, read receipts, alerts), `Messages.jsx` (full view), `MiniChatDrawer.jsx`, `FloatingMessageToast.jsx`
- `messageFilters.js` (pure helpers: `getIncomingMessages`, `isReadByRecipient`, `buildReplyTo`), `MessageStatus.jsx` (tick icons), `audioAlert.js` (`playMessageChime`, Web Audio)
- `src/App.jsx` mounts the toast and the drawer, and the mobile dock's Messages button, only when `canAccess(role, 'messages')` (D-MSG-03).

## Firestore collections it owns or writes

- Owns `messages` (id `msg_<send time in ms>_<rand>`) and `typing_indicators` (one document per user).

## Behaviour to keep

- **History window (D-MSG-05):** the listener reads `participants array-contains me` and `documentId() >= msg_<since>`, starting 30 days back; "Load older messages" in `Messages.jsx` calls `loadOlderMessages`, which moves `historySince` back another 30 days and re-subscribes. This relies on every message id starting with `msg_<ms timestamp>` (13 digits, so string order is time order); `sendDirectMessage` is the only writer. A count limit (`orderBy('timestamp')` + `limit`) was avoided because it needs a composite index, which is a separate deploy. Not checked against live Firestore index behaviour; the emulator does not enforce indexes.
- **Sends (D-MSG-07):** `sendDirectMessage` shows the message at once with `status: 'sending'` (clock icon) until `addDocument` resolves; on failure it drops the copy and rethrows. Callers restore the typed text and show "Message not sent: ..." (`Messages.jsx`, `MiniChatDrawer.jsx`; the toast keeps its reply text).
- **Replies (D-MSG-09):** every stored `replyTo` is `{ id, text, fromId, senderName }` from `buildReplyTo`; older replies without `senderName` render the sender id.
- **Typing (D-MSG-04):** at most one `typing_indicators` write per 800 ms while typing, one when cleared; "is typing" shows only if the indicator's `channelId` is the open conversation.
- **Alerts (D-MSG-06):** an incoming unread message raises the toast, a browser notification and a chime (unless `currentUser.audioAlertsEnabled === false`) unless that chat is open **and** the page is visible and focused.
- **Feed (D-MSG-12):** `NotificationsView.jsx` lists only messages from others (`getIncomingMessages`).
- **Broadcasts (D-MSG-11):** `messages` is for 1-on-1 staff chat only (`channelId` = the two ids sorted, `participants` = two ids). Company-wide announcements are a future milestone with their own collection or feed; do not add multi-recipient messages here.

## Before you edit

- `firestore.rules` on this branch (not yet deployed live): `messages` reads need `messages:view` and being a participant (or Admin); creates must be sent as yourself into your own conversation; recipients may update only `readBy` and `updatedAt`. `typing_indicators` is still readable and writable by any signed-in user (Wave B follow-up in BACKLOG FEA-6).
- `markChatAsRead` and `markAllAsRead` still send one `updateDocument` per message (the `writeBatch` half of D-MSG-02 is open).
- Conversations are derived from `channelId`; there is no thread document.
- Tests: `tests/component/MessagingContext.test.jsx`, `Messages.test.jsx`, `MiniChatDrawer.test.jsx`, `FloatingMessageToast.test.jsx`, `NotificationsView.test.jsx`, `App.messagingGate.test.jsx`, `tests/unit/messageFilters.test.js`.
