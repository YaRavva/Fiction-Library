import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTimerSettings() {
  try {
    console.log('Checking timer settings...');
    
    const { data, error } = await supabase
      .from('timer_settings')
      .select('*')
      .eq('process_name', 'deduplication')
      .single();

    if (error) {
      console.error('Error fetching timer settings:', error);
      return;
    }

    console.log('Timer settings found:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTimerSettings();