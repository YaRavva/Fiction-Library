-- Function to restore admin rights for a user
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

-- Grant execute permission to authenticated users (optional)
-- GRANT EXECUTE ON FUNCTION restore_admin_rights(TEXT) TO authenticated;