# Notifications: module notes for Claude

Full map: [../notifications.md](../notifications.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

A session-only in-app feed built on a browser `EventTarget`; most toasts and one commission event become feed entries; messages are merged in.

## Code

- `src/components/dashboard/NotificationsView.jsx`, `src/utils/events.js`, `src/utils/toast.js`; state and badges in `src/App.jsx`

## Firestore collections it owns or writes

- **Nothing persisted** for system notifications. Message read state is `messages.readBy`.

## Triggers and side effects

- Every `toast.*` call also emits a feed entry. Browser `Notification` API only for chat messages. No FCM, email or WhatsApp channel.

## Before you edit

- Entries vanish on reload and are visible only to the user whose browser fired them. Sign-out clears the list and unread count (`handleSignOut`), and the messages part of the feed drops the user's own messages (`getIncomingMessages`).
- `read` on entries is never used; only the unread counter matters.
