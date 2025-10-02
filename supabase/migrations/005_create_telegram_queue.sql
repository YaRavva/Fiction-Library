-- Migration: create tables for telegram integration queue

-- Create table to track telegram messages processed
CREATE TABLE IF NOT EXISTS telegram_messages (
  telegram_message_id TEXT PRIMARY KEY,
  channel TEXT,
  raw_text TEXT,
  processed_at TIMESTAMPTZ
);

-- Create telegram_download_queue table (aligned with queue.ts DownloadTask interface)
CREATE TABLE IF NOT EXISTS telegram_download_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  file_id TEXT,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  priority INT DEFAULT 0,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_download_queue_status ON telegram_download_queue(status);
CREATE INDEX IF NOT EXISTS idx_telegram_download_queue_message_id ON telegram_download_queue(message_id);
CREATE INDEX IF NOT EXISTS idx_telegram_download_queue_priority ON telegram_download_queue(priority DESC, scheduled_for ASC);
CREATE INDEX IF NOT EXISTS idx_telegram_download_queue_book_id ON telegram_download_queue(book_id);

-- Create a download queue for files to process (legacy table for backward compatibility)
CREATE TABLE IF NOT EXISTS download_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_message_id TEXT REFERENCES telegram_messages(telegram_message_id) ON DELETE SET NULL,
  telegram_file_id TEXT,
  filename TEXT,
  size BIGINT,
  status TEXT DEFAULT 'pending', -- pending | processing | done | error
  attempts INT DEFAULT 0,
  last_error TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status);
CREATE INDEX IF NOT EXISTS idx_download_queue_telegram_message_id ON download_queue(telegram_message_id);

-- RPC function: Get next download task (atomic operation with row locking)
CREATE OR REPLACE FUNCTION get_next_download_task()
RETURNS TABLE (
  id UUID,
  message_id TEXT,
  channel_id TEXT,
  file_id TEXT,
  book_id UUID,
  status TEXT,
  error_message TEXT,
  retry_count INT,
  priority INT,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  task_record RECORD;
BEGIN
  -- Find and lock the next pending task with highest priority
  SELECT * INTO task_record
  FROM telegram_download_queue
  WHERE status = 'pending'
    AND scheduled_for <= now()
    AND retry_count < 3
  ORDER BY priority DESC, scheduled_for ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no task found, return empty
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Update task status to processing
  UPDATE telegram_download_queue
  SET
    status = 'processing',
    started_at = now(),
    updated_at = now()
  WHERE telegram_download_queue.id = task_record.id;

  -- Return the task
  RETURN QUERY
  SELECT
    task_record.id,
    task_record.message_id,
    task_record.channel_id,
    task_record.file_id,
    task_record.book_id,
    'processing'::TEXT as status,
    task_record.error_message,
    task_record.retry_count,
    task_record.priority,
    task_record.scheduled_for,
    now() as started_at,
    task_record.completed_at,
    task_record.created_at,
    now() as updated_at;
END;
$$;

-- RPC function: Complete download task (mark as completed or failed)
CREATE OR REPLACE FUNCTION complete_download_task(
  task_id UUID,
  success BOOLEAN,
  error_msg TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF success THEN
    -- Mark task as completed
    UPDATE telegram_download_queue
    SET
      status = 'completed',
      completed_at = now(),
      updated_at = now(),
      error_message = NULL
    WHERE id = task_id;
  ELSE
    -- Mark task as failed or retry
    UPDATE telegram_download_queue
    SET
      status = CASE
        WHEN retry_count + 1 >= 3 THEN 'failed'
        ELSE 'pending'
      END,
      retry_count = retry_count + 1,
      error_message = error_msg,
      updated_at = now(),
      scheduled_for = CASE
        WHEN retry_count + 1 >= 3 THEN scheduled_for
        ELSE now() + (interval '5 minutes' * (retry_count + 1))
      END,
      started_at = NULL
    WHERE id = task_id;
  END IF;
END;
$$;
