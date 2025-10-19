# Telegram Statistics Panel Update

## Overview
This document describes the changes made to update the admin panel's Statistics section to display correct numbers from the `telegram_stats` table.

## Problem
The original implementation expected a specific table structure for `telegram_stats` that didn't match the actual database schema. The expected columns were:
- `books_in_database`
- `books_in_telegram`
- `missing_books`
- `books_without_files`

However, the actual table structure was:
- `id`
- `date`
- `messages_processed`
- `files_downloaded`
- `errors_count`
- `created_at`
- `updated_at`

## Solution
Updated both the API endpoint and the frontend component to work with the actual table structure by mapping the real column names to the expected interface:

| Real Column Name     | Mapped to Property    | Reasoning |
|----------------------|-----------------------|-----------|
| `messages_processed` | `booksInTelegram`     | Represents the number of Telegram messages processed |
| `files_downloaded`   | `booksInDatabase`     | Represents the number of files successfully downloaded |
| `errors_count`       | `missingBooks`        | Represents the number of errors encountered |
| `0` (hardcoded)      | `booksWithoutFiles`   | This value is not available in the real table |

## Files Modified

1. **`src/app/api/admin/telegram-stats/route.ts`**
   - Updated the GET endpoint to fetch data from the real table structure
   - Updated the POST endpoint to work with the real table structure
   - Removed the complex statistics calculation logic since we now use existing data

2. **`src/components/admin/telegram-stats.tsx`**
   - Updated the UI labels to reflect the actual data being displayed
   - Changed icons to better represent the actual metrics
   - Maintained the same animation and update functionality

## UI Changes
The labels in the Statistics panel were updated to better reflect the actual data:

1. **Сообщений обработано** (Messages processed) - shows `messages_processed`
2. **Файлов скачано** (Files downloaded) - shows `files_downloaded`
3. **Ошибок** (Errors) - shows `errors_count`
4. **Файлов без метаданных** (Files without metadata) - shows 0 (placeholder)

## Testing
A test script was created at `src/scripts/test-telegram-stats.ts` to verify the mapping works correctly.

## Future Improvements
1. Consider updating the database schema to match the expected structure if the current mapping is not intuitive
2. Add the missing `books_without_files` metric to the actual table if this data is important
3. Consider renaming the UI labels to be more generic if they will continue to represent different metrics