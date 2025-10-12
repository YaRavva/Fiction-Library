# Book Deduplication System

## Overview

The book deduplication functionality provides both automatic and manual deduplication capabilities. Automatic deduplication runs on a configurable schedule, while manual deduplication can be triggered through the admin panel.

## How It Works

### During Metadata Sync (Integrated)
1. When syncing metadata from Telegram channels, each book is checked against existing entries in the database
2. Duplicate detection is based on:
   - Title and author matching
   - Optional publication year matching for more precise detection
3. If a duplicate is found during sync:
   - If the existing book has no file but the new entry has cover images, the existing book is updated with the cover
   - If both books have files/covers, the duplicate is skipped
   - If neither has files, metadata is merged/updated

### Automatic Deduplication (Scheduled)
1. Runs on a configurable schedule via timer settings
2. Processes all books in the database
3. Handles duplicates based on file availability:
   - If existing book has no file but duplicate has one, update existing and delete duplicate
   - If both have files, keep existing and delete duplicate
   - If neither has files, delete duplicate

### Manual Deduplication
1. Can be triggered through the admin panel
2. Provides both analysis and execution modes
3. Shows detailed results of the deduplication process

## Timer Settings

The deduplication process can be configured through the admin panel timer settings:

1. Enable/disable automatic deduplication
2. Set interval (5-1440 minutes)
3. View last run and next scheduled run times

## API Endpoints

### GET /api/admin/timer-settings
Get current timer settings for all processes

### PUT /api/admin/timer-settings
Update timer settings for all processes

### POST /api/admin/deduplicate
Run manual deduplication (requires admin authentication)

### GET /api/cron/deduplicate
Run scheduled deduplication (can be secured with CRON_AUTH_TOKEN)

## Scripts

### Automated Deduplication
```bash
pnpm deduplicate
```

## Database Structure

The system uses the timer_settings table to store configuration:
- process_name: 'deduplication'
- enabled: boolean
- interval_minutes: integer (5-1440)
- last_run: timestamp
- next_run: timestamp

## Monitoring

Deduplication results are logged and can be viewed in:
- Admin panel deduplication controls
- Console output for automated runs
- Timer settings status display