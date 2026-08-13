# Active Context
## Current focus
- Admin operations dashboard is simplified around automatic updates; embedding controls are temporarily disabled.
- Temporarily disable embedding generation while preserving lexical file matching.
- Operation history shows final status, real duration only for completed jobs, and a readable failure reason.
- S3 book downloads use Cloud.ru virtual-hosted presigned URLs.
- All book reading and download entry points use the shared server-side S3 proxy.
## Active decisions
- The dashboard uses direct CSS grid placement with a uniform `gap-6`.
- Automatic BookWorm matching remains lexical-only while embedding generation is disabled.
## Blockers
- None.
