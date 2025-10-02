/**
 * Comprehensive database cleanup script
 * Removes duplicates and optimizes the database
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

interface Series {
  id: string;
  title: string;
  author: string;
  created_at: string;
}

async function cleanupDatabase() {
  console.log('🧹 Starting database cleanup...');
  
  try {
    // 1. Remove duplicate books (keep oldest)
    console.log('\n1. Removing duplicate books...');
    const bookRemovalResult = await removeDuplicateBooks();
    
    // 2. Remove duplicate series (keep oldest)
    console.log('\n2. Removing duplicate series...');
    const seriesRemovalResult = await removeDuplicateSeries();
    
    // 3. Clean up orphaned records
    console.log('\n3. Cleaning up orphaned records...');
    const orphanedCleanupResult = await cleanupOrphanedRecords();
    
    // 4. Update statistics
    console.log('\n4. Updating database statistics...');
    const stats = await getDatabaseStats();
    
    console.log('\n✅ Database cleanup completed!');
    console.log('\n📊 Results:');
    console.log(`   Books removed: ${bookRemovalResult.removed}`);
    console.log(`   Series removed: ${seriesRemovalResult.removed}`);
    console.log(`   Orphaned records cleaned: ${orphanedCleanupResult.cleaned}`);
    console.log(`   Final book count: ${stats.books}`);
    console.log(`   Final series count: ${stats.series}`);
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  }
}

async function removeDuplicateBooks() {
  try {
    // Find and remove duplicate books
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('id, title, author, created_at')
      .order('title')
      .order('author')
      .order('created_at');

    if (fetchError) {
      console.error('Error fetching books:', fetchError);
      return { removed: 0, error: fetchError.message };
    }

    if (!books || books.length === 0) {
      console.log('No books found');
      return { removed: 0 };
    }

    // Group books by title and author
    const bookGroups: Record<string, Book[]> = {};
    
    for (const book of books) {
      const key = `${book.title}:::${book.author}`;
      if (!bookGroups[key]) {
        bookGroups[key] = [];
      }
      bookGroups[key].push(book);
    }

    // Find duplicates and remove extras
    let removedCount = 0;
    
    for (const key in bookGroups) {
      const group = bookGroups[key];
      if (group.length > 1) {
        // Sort by creation date (oldest first)
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Remove all but the first (oldest) book
        const booksToRemove = group.slice(1);
        
        for (const bookToRemove of booksToRemove) {
          const { error: deleteError } = await supabase
            .from('books')
            .delete()
            .eq('id', bookToRemove.id);
            
          if (deleteError) {
            console.error(`Failed to remove book ${bookToRemove.id}:`, deleteError.message);
          } else {
            removedCount++;
          }
        }
      }
    }

    console.log(`Removed ${removedCount} duplicate books`);
    return { removed: removedCount };
  } catch (error) {
    console.error('Error removing duplicate books:', error);
    return { removed: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function removeDuplicateSeries() {
  try {
    // Find and remove duplicate series
    const { data: series, error: fetchError } = await supabase
      .from('series')
      .select('id, title, author, created_at')
      .order('title')
      .order('author')
      .order('created_at');

    if (fetchError) {
      console.error('Error fetching series:', fetchError);
      return { removed: 0, error: fetchError.message };
    }

    if (!series || series.length === 0) {
      console.log('No series found');
      return { removed: 0 };
    }

    // Group series by title and author
    const seriesGroups: Record<string, Series[]> = {};
    
    for (const s of series) {
      const key = `${s.title}:::${s.author}`;
      if (!seriesGroups[key]) {
        seriesGroups[key] = [];
      }
      seriesGroups[key].push(s);
    }

    // Find duplicates and remove extras
    let removedCount = 0;
    
    for (const key in seriesGroups) {
      const group = seriesGroups[key];
      if (group.length > 1) {
        // Sort by creation date (oldest first)
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Remove all but the first (oldest) series
        const seriesToRemove = group.slice(1);
        
        for (const sToRemove of seriesToRemove) {
          const { error: deleteError } = await supabase
            .from('series')
            .delete()
            .eq('id', sToRemove.id);
            
          if (deleteError) {
            console.error(`Failed to remove series ${sToRemove.id}:`, deleteError.message);
          } else {
            removedCount++;
          }
        }
      }
    }

    console.log(`Removed ${removedCount} duplicate series`);
    return { removed: removedCount };
  } catch (error) {
    console.error('Error removing duplicate series:', error);
    return { removed: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function cleanupOrphanedRecords() {
  try {
    let cleanedCount = 0;
    
    // Clean up books with invalid series_id references
    // We need to do this with a raw SQL query since Supabase JS client doesn't support JOINs well
    const { data: invalidBooks, error: booksError } = await supabase
      .from('books')
      .select('id, series_id')
      .not('series_id', 'is', null);

    if (booksError) {
      console.error('Error finding books with series_id:', booksError);
    } else if (invalidBooks && invalidBooks.length > 0) {
      // For each book with series_id, check if the series exists
      const booksToUpdate: string[] = [];
      
      for (const book of invalidBooks) {
        if (book.series_id) {
          const { data: series, error: seriesError } = await supabase
            .from('series')
            .select('id')
            .eq('id', book.series_id)
            .single();
          
          if (seriesError || !series) {
            // Series doesn't exist, so we need to clear the series_id
            booksToUpdate.push(book.id);
          }
        }
      }
      
      if (booksToUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from('books')
          .update({ series_id: null })
          .in('id', booksToUpdate);
        
        if (updateError) {
          console.error('Error cleaning up orphaned books:', updateError);
        } else {
          cleanedCount += booksToUpdate.length;
          console.log(`Cleaned up ${booksToUpdate.length} orphaned book references`);
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} orphaned records`);
    return { cleaned: cleanedCount };
  } catch (error) {
    console.error('Error cleaning up orphaned records:', error);
    return { cleaned: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getDatabaseStats() {
  try {
    const { count: bookCount, error: bookError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });

    if (bookError) {
      console.error('Error counting books:', bookError);
    }

    const { count: seriesCount, error: seriesError } = await supabase
      .from('series')
      .select('*', { count: 'exact', head: true });

    if (seriesError) {
      console.error('Error counting series:', seriesError);
    }

    return {
      books: bookCount || 0,
      series: seriesCount || 0
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return { books: 0, series: 0 };
  }
}

// Run the cleanup if script is executed directly
if (require.main === module) {
  console.log('⚠️  This script will clean up the database by removing duplicates.');
  console.log('⚠️  It will keep the oldest records and remove newer duplicates.');
  console.log('⚠️  This action cannot be undone!\n');
  
  // In a real scenario, you would prompt for confirmation
  cleanupDatabase();
}

export { cleanupDatabase, removeDuplicateBooks, removeDuplicateSeries, cleanupOrphanedRecords };