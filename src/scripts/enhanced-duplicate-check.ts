/**
 * Enhanced duplicate checking script for books
 * This script provides more sophisticated duplicate detection
 */

import { createClient } from '@supabase/supabase-js';

// Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface Book {
  id: string;
  title: string;
  author: string;
  publication_year?: number;
  created_at: string;
}

/**
 * Enhanced duplicate checking function
 * Checks for duplicates based on multiple criteria
 */
async function checkForDuplicates(
  title: string, 
  author: string, 
  publicationYear?: number
): Promise<{ exists: boolean; book?: Book }> {
  try {
    let query = supabase
      .from('books')
      .select('id, title, author, publication_year, created_at')
      .eq('title', title)
      .eq('author', author);
    
    // If publication year is provided, use it for more precise matching
    if (publicationYear) {
      query = query.eq('publication_year', publicationYear);
    }
    
    const { data, error } = await query.limit(1).single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "single row expected" which is expected when no rows found
      console.error('Error checking for duplicates:', error);
      return { exists: false };
    }
    
    return { 
      exists: !!data, 
      book: data || undefined 
    };
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { exists: false };
  }
}

/**
 * Fuzzy matching for similar titles
 */
async function findSimilarBooks(title: string, author: string): Promise<Book[]> {
  try {
    // This is a simple similarity check - in production you might want to use 
    // more sophisticated text similarity algorithms
    
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author, publication_year, created_at')
      .eq('author', author)
      .ilike('title', `%${title}%`);
    
    if (error) {
      console.error('Error finding similar books:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in similarity check:', error);
    return [];
  }
}

// Example usage
async function example() {
  console.log('🔍 Testing enhanced duplicate checking...');
  
  // Test exact match
  const result1 = await checkForDuplicates('Цикл Луна', 'Йен Макдональд', 2015);
  console.log('Exact match check:', result1);
  
  // Test fuzzy match
  const similar = await findSimilarBooks('Луна', 'Йен Макдональд');
  console.log('Similar books found:', similar.length);
  
  if (similar.length > 0) {
    similar.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} (${book.publication_year || 'Unknown year'})`);
    });
  }
}

// Run example if script is executed directly
if (require.main === module) {
  example();
}

export { checkForDuplicates, findSimilarBooks };