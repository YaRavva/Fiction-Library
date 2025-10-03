/**
 * Script to test downloading a book file from Telegram and uploading it to Supabase
 */

require('dotenv').config({ path: '.env' });

async function testBookFileDownload() {
  try {
    console.log('🔍 Testing book file download and upload...\n');
    
    // Dynamically import the sync service
    const { TelegramSyncService } = await import('../lib/telegram/sync.js');
    
    // Initialize Telegram sync service
    console.log('Initializing Telegram sync service...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Telegram sync service initialized');
    
    // Try to download a book (using a test message ID)
    console.log('Attempting to download a book file...');
    const buffer = await Promise.race([
      syncService.downloadBook(1), // Test with message ID 1
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Download took too long')), 30000)
      )
    ]);
    
    console.log(`✅ Successfully downloaded book file (${buffer.length} bytes)`);
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the script
testBookFileDownload().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});