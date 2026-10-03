## Changelog
- FEA-18: a recipient can now delete their own persisted notification (rules and `NotificationsView`, including clear-all), notification create is open to any active staff user with `recipientEmail`, `type`, `title`, `createdAt` required (Partner, Business Client, Customer refused), and marking an invoice paid for a partner with no email shows a warning toast instead of silently skipping. Rules not deployed until LIVE-1. Tests: component +3, rules +9.

## Testing map
- none

## Status
done; tests: unit 0, API 0, component +3, rules +9, e2e 0
