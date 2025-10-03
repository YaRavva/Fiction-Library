-- Make the books bucket public
-- This SQL script updates the books bucket to be publicly accessible

-- Update the books bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'books';

-- If the bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public) 
VALUES ('books', 'books', true)
ON CONFLICT (id) 
DO UPDATE SET public = true;

-- Grant read access to the public for the books bucket
-- This ensures that anyone can download books
GRANT ALL ON TABLE storage.objects TO postgres;
GRANT ALL ON TABLE storage.buckets TO postgres;