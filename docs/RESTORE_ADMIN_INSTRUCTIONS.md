# How to Restore Admin Rights for ravva@bk.ru

After clearing the database, the admin rights for user ravva@bk.ru were lost. Follow these steps to restore them:

## Method 1: Run SQL Commands in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the following SQL commands:

```sql
-- First, find your user ID:
SELECT id, email FROM auth.users WHERE email = 'ravva@bk.ru';

-- Then, either update existing profile or insert new one:
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

-- Verify the update:
SELECT up.id, u.email, up.role 
FROM user_profiles up
JOIN auth.users u ON up.id = u.id
WHERE u.email = 'ravva@bk.ru';
```

## Method 2: Create and Use a Function

If you prefer, you can first create a function and then call it:

```sql
-- Create the function
CREATE OR REPLACE FUNCTION restore_admin_rights(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
    user_id UUID;
    profile_exists BOOLEAN;
BEGIN
    -- Find the user ID by email
    SELECT id INTO user_id FROM auth.users WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RETURN 'User not found: ' || user_email;
    END IF;
    
    -- Check if user profile already exists
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = user_id) INTO profile_exists;
    
    IF profile_exists THEN
        -- Update existing profile to admin
        UPDATE user_profiles 
        SET role = 'admin', updated_at = NOW()
        WHERE id = user_id;
        
        RETURN 'Admin rights restored for existing user: ' || user_email;
    ELSE
        -- Create new user profile with admin rights
        INSERT INTO user_profiles (id, role, created_at, updated_at)
        VALUES (user_id, 'admin', NOW(), NOW());
        
        RETURN 'Admin rights restored for new user: ' || user_email;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Call the function
SELECT restore_admin_rights('ravva@bk.ru');
```

## Verification

After running the commands, you should see your user with role 'admin' in the user_profiles table. You can verify this by running:

```sql
SELECT up.id, u.email, up.role, up.created_at, up.updated_at
FROM user_profiles up
JOIN auth.users u ON up.id = u.id
WHERE u.email = 'ravva@bk.ru';
```

This should return one row with your user information and role set to 'admin'.