/**
 * Script to check storage buckets in Supabase
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

async function checkStorageBuckets() {
  try {
    console.log('🔍 Checking storage buckets in Supabase...\n');
    
    // Get all storage buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error fetching buckets:', error);
      return;
    }
    
    console.log('Storage Buckets:');
    console.log('================');
    
    if (!buckets || buckets.length === 0) {
      console.log('No buckets found');
      return;
    }
    
    buckets.forEach((bucket, index) => {
      console.log(`${index + 1}. ${bucket.name}`);
      console.log(`   ID: ${bucket.id}`);
      console.log(`   Public: ${bucket.public}`);
      console.log(`   Created: ${bucket.created_at}`);
      console.log('');
    });
    
    // Check if 'books' bucket exists
    const booksBucket = buckets.find(bucket => bucket.name === 'books');
    if (booksBucket) {
      console.log(`✅ Books bucket exists:`);
      console.log(`   Name: ${booksBucket.name}`);
      console.log(`   Public: ${booksBucket.public}`);
    } else {
      console.log('❌ Books bucket not found');
    }
    
    // Check if 'covers' bucket exists
    const coversBucket = buckets.find(bucket => bucket.name === 'covers');
    if (coversBucket) {
      console.log(`✅ Covers bucket exists:`);
      console.log(`   Name: ${coversBucket.name}`);
      console.log(`   Public: ${coversBucket.public}`);
    } else {
      console.log('❌ Covers bucket not found');
    }
    
    console.log('\n✅ Check completed');
    
  } catch (error) {
    console.error('Error during check:', error);
  }
}

// Run the script
checkStorageBuckets();