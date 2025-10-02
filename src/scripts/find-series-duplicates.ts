/**
 * Script to find and identify duplicate series in the database
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

interface Series {
  id: string;
  title: string;
  author: string;
  created_at: string;
}

async function findSeriesDuplicates() {
  try {
    console.log('🔍 Searching for duplicate series...');

    // Find series with the same title and author
    const { data: series, error } = await supabase
      .from('series')
      .select('id, title, author, created_at')
      .order('title')
      .order('author')
      .order('created_at');

    if (error) {
      console.error('Error fetching series:', error);
      return;
    }

    if (!series || series.length === 0) {
      console.log('No series found in database');
      return;
    }

    console.log(`Found ${series.length} series in database`);

    // Group series by title and author
    const seriesGroups: Record<string, Series[]> = {};
    
    for (const s of series) {
      const key = `${s.title}:::${s.author}`;
      if (!seriesGroups[key]) {
        seriesGroups[key] = [];
      }
      seriesGroups[key].push(s);
    }

    // Find duplicates (groups with more than one series)
    const duplicates: Series[][] = [];
    for (const key in seriesGroups) {
      if (seriesGroups[key].length > 1) {
        duplicates.push(seriesGroups[key]);
      }
    }

    if (duplicates.length === 0) {
      console.log('✅ No series duplicates found!');
      return;
    }

    console.log(`\n❌ Found ${duplicates.length} duplicate series groups:`);
    
    for (let i = 0; i < duplicates.length; i++) {
      const group = duplicates[i];
      console.log(`\n--- Group ${i + 1} ---`);
      console.log(`Title: ${group[0].title}`);
      console.log(`Author: ${group[0].author}`);
      console.log('Duplicates:');
      
      for (let j = 0; j < group.length; j++) {
        console.log(`  ${j + 1}. ID: ${group[j].id} (Created: ${group[j].created_at})`);
      }
    }

    console.log(`\n📊 Summary: ${duplicates.length} duplicate series groups found affecting ${duplicates.reduce((sum, group) => sum + group.length, 0)} series`);
    
  } catch (error) {
    console.error('Error finding series duplicates:', error);
  }
}

// Run the script
findSeriesDuplicates();