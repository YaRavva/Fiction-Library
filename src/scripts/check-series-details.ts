/**
 * Script to check detailed information about the "цикл Луна" series
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

async function checkSeriesDetails() {
  try {
    console.log('🔍 Checking detailed information about "цикл Луна" series...\n');
    
    // Find the "цикл Луна" series
    const { data: series, error } = await supabase
      .from('series')
      .select('*')
      .eq('title', 'цикл Луна')
      .eq('author', 'Йен Макдональд');
    
    if (error) {
      console.error('Error fetching series:', error);
      return;
    }
    
    if (!series || series.length === 0) {
      console.log('Series "цикл Луна" not found');
      return;
    }
    
    const lunaSeries = series[0];
    console.log('Series Details:');
    console.log('===============');
    console.log(`ID: ${lunaSeries.id}`);
    console.log(`Title: ${lunaSeries.title}`);
    console.log(`Author: ${lunaSeries.author}`);
    console.log(`Description: ${lunaSeries.description?.substring(0, 100)}...`);
    console.log(`Rating: ${lunaSeries.rating}`);
    console.log(`Genres: ${lunaSeries.genres?.join(', ')}`);
    console.log(`Tags: ${lunaSeries.tags?.join(', ')}`);
    console.log(`Cover URL (single): ${lunaSeries.cover_url}`);
    console.log(`Cover URLs (array): ${lunaSeries.cover_urls?.length || 0} items`);
    
    if (lunaSeries.cover_urls && lunaSeries.cover_urls.length > 0) {
      lunaSeries.cover_urls.forEach((url: string, index: number) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    }
    
    console.log(`\nSeries Composition: ${lunaSeries.series_composition?.length || 0} books`);
    if (lunaSeries.series_composition) {
      lunaSeries.series_composition.forEach((book: any, index: number) => {
        console.log(`  ${index + 1}. ${book.title} (${book.year})`);
      });
    }
    
    console.log('\n✅ Check completed');
    
  } catch (error) {
    console.error('Error during check:', error);
  }
}

// Run the script
checkSeriesDetails();