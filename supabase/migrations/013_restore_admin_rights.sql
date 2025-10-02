-- Script to restore admin rights for user ravva@bk.ru
-- First, find the user ID
-- SELECT id, email FROM auth.users WHERE email = 'ravva@bk.ru';

-- Then, either update existing profile or insert new one
-- Option 1: Update existing profile
UPDATE user_profiles 
SET role = 'admin', updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'ravva@bk.ru');

-- Option 2: Insert new profile if it doesn't exist
INSERT INTO user_profiles (id, role, created_at, updated_at)
SELECT id, 'admin', NOW(), NOW()
FROM auth.users 
WHERE email = 'ravva@bk.ru'
AND id NOT IN (SELECT id FROM user_profiles);

-- Verify the update
-- SELECT up.id, u.email, up.role 
-- FROM user_profiles up
-- JOIN auth.users u ON up.id = u.id
-- WHERE u.email = 'ravva@bk.ru';