/**
 * Script to check if there are any series with multiple covers in the database
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSeriesWithMultipleCovers() {
  try {
    console.log('🔍 Checking for series with multiple covers...\n');
    
    // Get all series
    const { data: series, error } = await supabase
      .from('series')
      .select('*');
    
    if (error) {
      console.error('Error fetching series:', error);
      return;
    }
    
    console.log(`Found ${series.length} series in total\n`);
    
    // Check for series with multiple covers
    let seriesWithMultipleCovers = 0;
    let seriesWithSingleCover = 0;
    let seriesWithoutCovers = 0;
    
    for (const s of series) {
      const coverCount = s.cover_urls?.length || 0;
      if (coverCount > 1) {
        seriesWithMultipleCovers++;
        console.log(`Series with multiple covers: "${s.title}" by ${s.author} (${coverCount} covers)`);
      } else if (coverCount === 1) {
        seriesWithSingleCover++;
      } else {
        seriesWithoutCovers++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Series with multiple covers: ${seriesWithMultipleCovers}`);
    console.log(`  - Series with single cover: ${seriesWithSingleCover}`);
    console.log(`  - Series without covers: ${seriesWithoutCovers}`);
    
    if (seriesWithMultipleCovers === 0) {
      console.log(`\n⚠️  No series with multiple covers found.`);
      console.log(`This confirms that all Telegram messages contain single images, not albums.`);
    }
    
    console.log('\n✅ Check completed');
    
  } catch (error) {
    console.error('Error during check:', error);
  }
}

// Run the script
checkSeriesWithMultipleCovers();