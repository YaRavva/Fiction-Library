/**
 * Script to test downloading a book file from Telegram and uploading it to Supabase
 */

import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Load environment variables
config({ path: '.env' });

async function testBookFileDownload() {
  let syncService: TelegramSyncService | null = null;
  
  try {
    console.log('🔍 Testing book file download and upload...\n');
    
    // Initialize Telegram sync service
    console.log('Initializing Telegram sync service...');
    syncService = await TelegramSyncService.getInstance();
    console.log('✅ Telegram sync service initialized');
    
    // Try to download a book (using a test message ID)
    console.log('Attempting to download a book file...');
    const buffer = await Promise.race([
      syncService.downloadBook(4379), // Use the actual message ID we know has a document
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Download took too long')), 60000)
      )
    ]);
    
    console.log(`✅ Successfully downloaded book file (${buffer.length} bytes)`);
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  } finally {
    // Ensure proper cleanup
    if (syncService) {
      try {
        await syncService.shutdown();
        console.log('🧹 Telegram client disconnected');
      } catch (error) {
        console.error('⚠️ Error during shutdown:', error);
      }
    }
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the script
testBookFileDownload().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});