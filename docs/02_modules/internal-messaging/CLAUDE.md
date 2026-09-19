# Internal Messaging: module notes for Claude

Full map: [../internal-messaging.md](../internal-messaging.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

1-on-1 direct chat over Firestore with unread badges, read receipts, typing indicators, toasts and browser notifications.

## Code

- `src/context/MessagingContext.jsx`, `src/components/tools/Messages.jsx`, `MiniChatDrawer.jsx`, `src/components/common/FloatingMessageToast.jsx`

## Firestore collections it owns or writes

- Owns `messages` (id `msg_<ts>_<rand>`) and `typing_indicators`.

## Triggers and side effects

- Incoming unread message: toast (unless that chat is open) and browser `Notification`. No server-side email, push or audit log.

## Before you edit

- Rules let any authenticated user read every message; the client filters by `participants`. The `messages` permission is not checked in rules (Partner has `none` client-side only).
- Conversations are derived from `channelId`; there is no thread document.
