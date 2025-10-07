-- Fiction Library Database Reading History Functions
-- Migration 004: Reading History Functions

-- Function to save reading position
CREATE OR REPLACE FUNCTION save_reading_position(
    user_id UUID,
    book_id UUID,
    reading_position INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
    INSERT INTO reading_history (user_id, book_id, last_position, last_read_at)
    VALUES (user_id, book_id, reading_position, NOW())
    ON CONFLICT (user_id, book_id)
    DO UPDATE SET 
        last_position = EXCLUDED.last_position,
        last_read_at = EXCLUDED.last_read_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get user's last reading position
CREATE OR REPLACE FUNCTION get_reading_position(
    user_id UUID,
    book_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    position_value INTEGER;
BEGIN
    SELECT last_position INTO position_value
    FROM reading_history
    WHERE user_id = get_reading_position.user_id
    AND book_id = get_reading_position.book_id;
    
    RETURN COALESCE(position_value, 0);
END;
$$ LANGUAGE plpgsql;