# Notifications: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

An in-app feed: toasts become session-only entries through a browser `EventTarget`; the commission-cleared event is a persisted `notifications` document addressed to the partner (FEA-2); messages are merged in.

## Code

- `src/features/dashboard/NotificationsView.jsx`, `src/shared/utils/events.js`, `src/shared/utils/toast.js`; state and badges in `src/App.jsx`

## Firestore collections it owns or writes

- `notifications` (FEA-2): written by `handleMarkInvoicePaid` with `recipientEmail`, `targetRole: 'Partner'`, `type: 'commission'`, `leadId`, `read`. `App.jsx` subscribes each user with `where('recipientEmail', '==', identifier)` and merges the result into the feed; opening the Notifications tab sets `read: true`. Rules rest on LIVE-1 (not deployed). Message read state is `messages.readBy`.

## Triggers and side effects

- Every `toast.*` call also emits a feed entry. Browser `Notification` API only for chat messages. No FCM, email or WhatsApp channel.

## Before you edit

- Entries vanish on reload and are visible only to the user whose browser fired them. Sign-out clears the list and unread count (`handleSignOut`), and the messages part of the feed drops the user's own messages (`getIncomingMessages`).
- Session-only entries carry no `read` and count in a local counter; persisted ones count by `read: false` and add to the badge. `NotificationsView` shows an entry only if it has no `recipientEmail` or the address is the signed-in user's.
- Deleting a persisted entry in the view is local only (rules allow no delete); it reappears when the snapshot next changes.
