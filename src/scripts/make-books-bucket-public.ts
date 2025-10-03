/**
 * Script to make the 'books' bucket public in Supabase Storage
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function makeBooksBucketPublic() {
  try {
    console.log('🔍 Making books bucket public...\n');
    
    // First, let's check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    const booksBucket = buckets?.find(bucket => bucket.name === 'books');
    
    if (!booksBucket) {
      console.log('❌ Books bucket not found. Creating it...');
      
      // Create the books bucket
      const { data: createData, error: createError } = await supabase.storage.createBucket('books', {
        public: true,
      });
      
      if (createError) {
        console.error('Error creating books bucket:', createError);
        return;
      }
      
      console.log('✅ Books bucket created successfully');
    } else {
      console.log('✅ Books bucket exists');
      console.log('Current public status:', booksBucket.public);
      
      if (!booksBucket.public) {
        console.log('🔄 Updating bucket to public...');
        
        // Update bucket to make it public
        // Note: Supabase doesn't have a direct API to update bucket visibility
        // We'll need to use SQL to update the bucket
        console.log('⚠️  Supabase doesn\'t provide direct API to update bucket visibility.');
        console.log('   You need to manually update the bucket in Supabase dashboard or use SQL.');
      } else {
        console.log('✅ Books bucket is already public');
      }
    }
    
    console.log('\n✅ Operation completed');
    
  } catch (error) {
    console.error('Error during operation:', error);
  }
}

// Run the script
makeBooksBucketPublic();