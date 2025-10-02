/**
 * Script to find and identify duplicate books in the database
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

interface Book {
  id: string;
  title: string;
  author: string;
  created_at: string;
}

async function findDuplicates() {
  try {
    console.log('🔍 Searching for duplicate books...');

    // Find books with the same title and author
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, created_at')
      .order('title')
      .order('author')
      .order('created_at');

    if (error) {
      console.error('Error fetching books:', error);
      return;
    }

    if (!books || books.length === 0) {
      console.log('No books found in database');
      return;
    }

    console.log(`Found ${books.length} books in database`);

    // Group books by title and author
    const bookGroups: Record<string, Book[]> = {};
    
    for (const book of books) {
      const key = `${book.title}:::${book.author}`;
      if (!bookGroups[key]) {
        bookGroups[key] = [];
      }
      bookGroups[key].push(book);
    }

    // Find duplicates (groups with more than one book)
    const duplicates: Book[][] = [];
    for (const key in bookGroups) {
      if (bookGroups[key].length > 1) {
        duplicates.push(bookGroups[key]);
      }
    }

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    console.log(`\n❌ Found ${duplicates.length} duplicate groups:`);
    
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

    console.log(`\n📊 Summary: ${duplicates.length} duplicate groups found affecting ${duplicates.reduce((sum, group) => sum + group.length, 0)} books`);
    
  } catch (error) {
    console.error('Error finding duplicates:', error);
  }
}

// Run the script
findDuplicates();