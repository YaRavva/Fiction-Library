# Progress

## Change Control
last_checked_commit: 2026-08-13 (working tree)

## Changelog
- 2026-08-13: Fixed Cloud.ru S3 presigned downloads by using virtual-hosted URLs and correcting the key/bucket argument order; verified both affected book files.
- 2026-08-13: Unified reader, library table, admin, and Cloud.ru download paths; removed direct file URL fallbacks and client-side duplicate download counting.
- 2026-07-09: Removed the interactive file search and file-linking UI, API routes, and unused services.
- 2026-07-09: Added a dedicated dashboard card for automatic updates and embedding generation; removed the completed-embeddings banner.
- 2026-07-09: Preserved direct-grid layout with a uniform `gap-6` and automatic BookWorm matching.
- 2026-08-13: Temporarily disabled embedding generation behind `EMBEDDINGS_ENABLED=false`; BookWorm now uses lexical-only matching and admin controls are hidden.
- 2026-08-13: Made auto-update await completion or timeout and simplified operation history statuses and error display.
