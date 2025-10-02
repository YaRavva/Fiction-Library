/**
 * Script to restore admin rights for a user
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config({ path: '.env.local' });
config({ path: '.env' });

// Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  console.error('Please ensure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function restoreAdminRights(email: string = 'ravva@bk.ru') {
  try {
    console.log(`Restoring admin rights for user: ${email}`);
    
    // Since we can't directly access auth.users, we'll try a different approach
    // First, let's try to sign in as the user to get their ID
    console.log('Attempting to restore admin rights...');
    
    // We'll use a raw SQL approach since we have service role key
    const { data, error } = await supabase.rpc('restore_admin_rights', { user_email: email });
    
    if (error) {
      console.log('Direct RPC failed, trying manual approach...');
      
      // Manual approach - you'll need to run this SQL in your Supabase dashboard:
      console.log(`
      
Please run the following SQL in your Supabase SQL Editor:

-- First, find your user ID:
SELECT id, email FROM auth.users WHERE email = '${email}';

-- Then, either update existing profile or insert new one:
-- Option 1: Update existing profile
UPDATE user_profiles 
SET role = 'admin', updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = '${email}');

-- Option 2: Insert new profile if it doesn't exist
INSERT INTO user_profiles (id, role, created_at, updated_at)
SELECT id, 'admin', NOW(), NOW()
FROM auth.users 
WHERE email = '${email}'
AND id NOT IN (SELECT id FROM user_profiles);

-- Verify the update:
SELECT up.id, u.email, up.role 
FROM user_profiles up
JOIN auth.users u ON up.id = u.id
WHERE u.email = '${email}';

`);
    } else {
      console.log('Admin rights restored successfully!');
    }
    
  } catch (error) {
    console.error('Error restoring admin rights:', error);
    console.log(`
    
Please run the following SQL in your Supabase SQL Editor:

-- First, find your user ID:
SELECT id, email FROM auth.users WHERE email = '${email}';

-- Then, either update existing profile or insert new one:
-- Option 1: Update existing profile
UPDATE user_profiles 
SET role = 'admin', updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = '${email}');

-- Option 2: Insert new profile if it doesn't exist
INSERT INTO user_profiles (id, role, created_at, updated_at)
SELECT id, 'admin', NOW(), NOW()
FROM auth.users 
WHERE email = '${email}'
AND id NOT IN (SELECT id FROM user_profiles);

-- Verify the update:
SELECT up.id, u.email, up.role 
FROM user_profiles up
JOIN auth.users u ON up.id = u.id
WHERE u.email = '${email}';

`);
  }
}

// Run the script
restoreAdminRights();