# Book Deduplication System

## Overview

The book deduplication functionality provides multiple approaches to handle duplicate books:
1. **Automatic deduplication** - runs on a configurable schedule
2. **Manual deduplication** - can be triggered through the admin panel
3. **Bulk deletion script** - removes existing duplicates from the database
4. **Enhanced deduplication service** - improved logic for preventing new duplicates

## How It Works

### During Metadata Sync (Integrated)
1. When syncing metadata from Telegram channels, each book is checked against existing entries in the database
2. Duplicate detection is based on:
   - Title and author matching with text normalization
   - Optional publication year matching for more precise detection
3. If a duplicate is found during sync:
   - If the existing book has no file but the new entry has one, update existing book with the file
   - If the existing book has no cover but new entry has one, update existing book with the cover
   - If existing book is missing other metadata but new entry has them, update existing book
   - If both books have files/covers with identical metadata, the duplicate is skipped
   - Data is merged to keep the best attributes from all sources

### Text Normalization
The system normalizes book titles and authors for improved matching:
- Removes years in parentheses (e.g., "(2023)", "(2019)")
- Removes language indicators like "ru"
- Converts to lowercase and removes extra whitespace
- This allows matching books with slight variations in titles/authors

### Automatic Deduplication (Scheduled)
1. Runs on a configurable schedule via timer settings
2. Processes all books in the database
3. Handles duplicates based on file availability and metadata completeness:
   - If existing book has no file but duplicate has one, update existing and delete duplicate
   - If both have files, keep existing and delete duplicate
   - If neither has files, delete duplicate

### Manual Deduplication
1. Can be triggered through the admin panel
2. Provides both analysis and execution modes
3. Shows detailed results of the deduplication process

### Bulk Duplicate Removal Script
A script for removing existing duplicates from the database:
- `remove-book-duplicates-enhanced.ts` - removes duplicates based on file availability and metadata completeness
- Prioritizes keeping books with files, covers, and more complete metadata
- Requires confirmation before deletion

## Improved Deduplication Algorithm

The enhanced system in `src/lib/book-deduplication-service.ts`:
1. **Prioritizes books with files** - books with file_url or telegram_file_id are kept over those without
2. **Preserves best metadata** - combines information from multiple sources to keep the most complete data
3. **Uses normalized matching** - accounts for variations in titles and authors
4. **Intelligent merging** - combines different attributes from duplicate entries

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

### Bulk Duplicate Removal
```bash
npx tsx remove-book-duplicates-enhanced.ts
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