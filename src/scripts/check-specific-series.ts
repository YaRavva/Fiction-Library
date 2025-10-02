/**
 * Script to check a specific series in detail
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

async function checkSpecificSeries(seriesTitle: string = 'цикл Луна') {
  try {
    console.log(`🔍 Checking series "${seriesTitle}" in detail...`);
    
    // Get the specific series with its books
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select(`
        id, 
        title, 
        author, 
        cover_url, 
        cover_urls, 
        series_composition,
        created_at,
        updated_at,
        books (
          id,
          title,
          author,
          publication_year,
          cover_url
        )
      `)
      .eq('title', seriesTitle)
      .single();
    
    if (seriesError) {
      console.error('Error fetching series:', seriesError);
      return;
    }
    
    if (!series) {
      console.log(`Series "${seriesTitle}" not found in database`);
      return;
    }
    
    console.log(`\n--- Series: ${series.title} by ${series.author} ---`);
    console.log(`ID: ${series.id}`);
    console.log(`Created: ${series.created_at}`);
    console.log(`Updated: ${series.updated_at}`);
    console.log(`Single cover URL: ${series.cover_url || 'None'}`);
    console.log(`Cover URLs array: ${series.cover_urls ? series.cover_urls.length : 0} items`);
    
    if (series.cover_urls && series.cover_urls.length > 0) {
      series.cover_urls.forEach((url: string, index: number) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    }
    
    console.log(`\nSeries composition (${series.series_composition ? series.series_composition.length : 0} books):`);
    if (series.series_composition) {
      series.series_composition.forEach((book: any, index: number) => {
        console.log(`  ${index + 1}. ${book.title} (${book.year})`);
      });
    }
    
    console.log(`\nBooks in database (${series.books ? series.books.length : 0} books):`);
    if (series.books) {
      series.books.forEach((book: any, index: number) => {
        console.log(`  ${index + 1}. ${book.title} (${book.publication_year || 'Unknown year'})`);
        console.log(`     Cover: ${book.cover_url || 'None'}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking specific series:', error);
  }
}

// Run the script with the specified series or default to "цикл Луна"
const seriesToCheck = process.argv[2] || 'цикл Луна';
checkSpecificSeries(seriesToCheck);