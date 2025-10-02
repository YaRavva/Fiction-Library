/**
 * Script to remove duplicate books from the database
 * Keeps the oldest book (first created) and removes the newer duplicates
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

async function removeDuplicates() {
  try {
    console.log('🔍 Searching for duplicate books to remove...');

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
        // Sort by creation date (oldest first)
        bookGroups[key].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        duplicates.push(bookGroups[key]);
      }
    }

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    console.log(`\n❌ Found ${duplicates.length} duplicate groups:`);
    
    let totalRemoved = 0;
    
    for (let i = 0; i < duplicates.length; i++) {
      const group = duplicates[i];
      console.log(`\n--- Group ${i + 1} ---`);
      console.log(`Title: ${group[0].title}`);
      console.log(`Author: ${group[0].author}`);
      
      // Keep the first (oldest) book, remove the rest
      const booksToRemove = group.slice(1);
      console.log(`Removing ${booksToRemove.length} duplicate(s):`);
      
      for (let j = 0; j < booksToRemove.length; j++) {
        const bookToRemove = booksToRemove[j];
        console.log(`  - ID: ${bookToRemove.id} (Created: ${bookToRemove.created_at})`);
        
        // Remove the duplicate book
        const { error: deleteError } = await supabase
          .from('books')
          .delete()
          .eq('id', bookToRemove.id);
          
        if (deleteError) {
          console.error(`    ❌ Failed to remove book ${bookToRemove.id}:`, deleteError.message);
        } else {
          console.log(`    ✅ Successfully removed book ${bookToRemove.id}`);
          totalRemoved++;
        }
      }
    }

    console.log(`\n📊 Summary: Removed ${totalRemoved} duplicate books`);
    
  } catch (error) {
    console.error('Error removing duplicates:', error);
  }
}

// Ask for confirmation before proceeding
console.log('⚠️  This script will remove duplicate books from the database.');
console.log('⚠️  It will keep the oldest book and remove newer duplicates.');
console.log('⚠️  This action cannot be undone!\n');

// In a real scenario, you would prompt for confirmation
// For now, we'll just run the function
removeDuplicates();