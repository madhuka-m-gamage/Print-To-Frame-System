# Notifications: module notes for Claude

Full map: [README.md](README.md). Cross-module chains: [CROSS_MODULE_TRIGGERS.md](../../01_architecture/CROSS_MODULE_TRIGGERS.md). Review findings: [FINDINGS.md](FINDINGS.md). There are no Cloud Functions; all automation is client code (`src/App.jsx`, components) or `api/*.js`.

## What it does

An in-app feed of persisted `notifications` documents (commission-cleared to the partner, FEA-2; a toast marked `notify` to the signed-in user, FEA-7) with unread chat messages merged in. Plain toasts are not in the feed.

## Code

- `src/features/dashboard/NotificationsView.jsx`, `src/shared/utils/events.js`, `src/shared/utils/toast.js`; state and badges in `src/App.jsx`

## Firestore collections it owns or writes

- `notifications` (FEA-2): written by `handleMarkInvoicePaid` with `recipientEmail`, `targetRole: 'Partner'`, `type: 'commission'`, `leadId`, `read`. `App.jsx` subscribes each user with `where('recipientEmail', '==', identifier)` and merges the result into the feed; opening the Notifications tab sets `read: true`. Rules rest on LIVE-1 (not deployed). Message read state is `messages.readBy`.

## Triggers and side effects

- A plain `toast.*` call is toast-only (FEA-7). `toast.x(msg, { notify: true, description })` emits on the `EventTarget` bus; `App.jsx` stores it as a `notifications` document for the signed-in user (`recipientEmail`, `targetRole`, `type`, `title`, `message`, `read: false`, `date`, `createdBy`; `addDocument` adds `createdAt`) and the subscription shows it. Events that use `notify`: the "deal fully settled" toast in `handleMarkInvoicePaid`. Other persisted event: commission cleared (written directly, not through a toast). Browser `Notification` API only for chat messages. No FCM, email or WhatsApp channel.

## Before you edit

- Sign-out clears the list and unread count (`handleSignOut`), and the messages part of the feed drops the user's own messages (`getIncomingMessages`).
- The badge is the count of persisted entries with `read: false`; there is no session-only counter or entry any more. The chat-message part of the feed shows only messages the user has not read (`readBy`), so "Mark Messages Read" empties it. `NotificationsView` shows an entry only if it has no `recipientEmail` or the address is the signed-in user's.
- Deleting a persisted entry in the view deletes the Firestore doc (FEA-18; only the recipient may delete); session-only entries are removed locally. "Clear all" deletes the persisted system alerts the same way.
- Create is open to any active staff user (not Partner, Business Client, Customer) with `recipientEmail`, `type`, `title`, `createdAt` present. When the referring partner has no email, `handleMarkInvoicePaid` shows a warning toast and stores no notification (FEA-18).
