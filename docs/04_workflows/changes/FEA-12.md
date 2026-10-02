## Changelog
- Messaging: `markChatAsRead` and `markAllAsRead` send read receipts with `batchWrite` in chunks of 500 instead of one write per message (D-MSG-02 closed). Component tests for 0, 1, 3 and 501 unread (component 175).

## Testing map
- none

## Status
done; tests: unit 294, API 0, component 175, rules 0, e2e 0
