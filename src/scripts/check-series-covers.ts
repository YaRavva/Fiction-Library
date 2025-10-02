/**
 * Script to check series cover URLs in the database
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

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSeriesCovers() {
  try {
    console.log('🔍 Checking series cover URLs in database...');
    
    // Get all series with their cover information
    const { data: series, error } = await supabase
      .from('series')
      .select('id, title, author, cover_url, cover_urls, created_at')
      .order('title');
    
    if (error) {
      console.error('Error fetching series:', error);
      return;
    }
    
    if (!series || series.length === 0) {
      console.log('No series found in database');
      return;
    }
    
    console.log(`Found ${series.length} series in database:\n`);
    
    for (const s of series) {
      console.log(`--- ${s.title} by ${s.author} ---`);
      console.log(`ID: ${s.id}`);
      console.log(`Single cover URL: ${s.cover_url || 'None'}`);
      console.log(`Cover URLs array: ${s.cover_urls ? s.cover_urls.length : 0} items`);
      
      if (s.cover_urls && s.cover_urls.length > 0) {
        s.cover_urls.forEach((url: string, index: number) => {
          console.log(`  ${index + 1}. ${url}`);
        });
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error checking series covers:', error);
  }
}

// Run the script
checkSeriesCovers();