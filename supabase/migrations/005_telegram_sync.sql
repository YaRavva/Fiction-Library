-- Fiction Library Database Schema
-- Migration 005: Telegram Sync Support

-- First add missing telegram_post_id columns
ALTER TABLE books ADD COLUMN IF NOT EXISTS telegram_post_id VARCHAR(100);
ALTER TABLE series ADD COLUMN IF NOT EXISTS telegram_post_id VARCHAR(100);

-- Telegram sync status (статус синхронизации)
CREATE TABLE telegram_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id VARCHAR(100) NOT NULL,
    last_message_id VARCHAR(100),
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_count INTEGER DEFAULT 0 CHECK (error_count >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id)
);

-- Telegram download queue (очередь скачивания)
CREATE TABLE telegram_download_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(100) NOT NULL,
    channel_id VARCHAR(100) NOT NULL,
    file_id VARCHAR(100),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    priority INTEGER DEFAULT 0,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for queue processing
CREATE INDEX idx_telegram_queue_status ON telegram_download_queue (status, priority DESC, scheduled_for ASC);

-- Create function to get next download task
CREATE OR REPLACE FUNCTION get_next_download_task()
RETURNS TABLE (
    id UUID,
    message_id VARCHAR(100),
    channel_id VARCHAR(100),
    file_id VARCHAR(100),
    book_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH next_task AS (
        SELECT tq.id
        FROM telegram_download_queue tq
        WHERE tq.status = 'pending'
          AND tq.scheduled_for <= NOW()
        ORDER BY tq.priority DESC, tq.scheduled_for ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE telegram_download_queue tq
    SET status = 'processing',
        started_at = NOW(),
        updated_at = NOW()
    FROM next_task
    WHERE tq.id = next_task.id
    RETURNING tq.id, tq.message_id, tq.channel_id, tq.file_id, tq.book_id;
END;
$$;

-- Create function to mark download task as completed
CREATE OR REPLACE FUNCTION complete_download_task(task_id UUID, success BOOLEAN, error_msg TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE telegram_download_queue
    SET status = CASE WHEN success THEN 'completed' ELSE 'failed' END,
        completed_at = NOW(),
        error_message = CASE WHEN success THEN NULL ELSE error_msg END,
        retry_count = CASE WHEN success THEN retry_count ELSE retry_count + 1 END,
        scheduled_for = CASE 
            WHEN success THEN scheduled_for
            ELSE NOW() + (INTERVAL '5 minutes' * POWER(2, retry_count))
        END,
        updated_at = NOW()
    WHERE id = task_id;

    -- If failed and retry limit not reached, set back to pending
    UPDATE telegram_download_queue
    SET status = 'pending'
    WHERE id = task_id 
      AND status = 'failed'
      AND retry_count < 5;
END;
$$;

-- Add new columns to books and series tables
ALTER TABLE books 
    ADD COLUMN IF NOT EXISTS telegram_channel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    ADD COLUMN IF NOT EXISTS sync_error TEXT;

ALTER TABLE series
    ADD COLUMN IF NOT EXISTS telegram_channel_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_books_telegram_sync ON books (telegram_channel_id, telegram_post_id) WHERE telegram_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_series_telegram_sync ON series (telegram_channel_id, telegram_post_id) WHERE telegram_channel_id IS NOT NULL;

-- Security policies
ALTER TABLE telegram_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_download_queue ENABLE ROW LEVEL SECURITY;

-- Only admin can manage sync status
CREATE POLICY "Admin can manage sync status"
    ON telegram_sync_status
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.role = 'admin'
    ));

-- Only admin can manage download queue
CREATE POLICY "Admin can manage download queue"
    ON telegram_download_queue
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.role = 'admin'
    ));