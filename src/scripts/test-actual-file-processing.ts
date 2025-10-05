/**
 * Actual test script to process real files from Telegram using existing TelegramSyncService
 * This script uses the same logic as the production system to test file processing
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables FIRST
config({ path: '.env' });

async function testActualFileProcessing() {
  console.log('🚀 Testing actual file processing from Telegram...\n');
  
  try {
    // Dynamically import TelegramSyncService after dotenv is loaded
    const { TelegramSyncService } = await import('../lib/telegram/sync');
    
    // Create instance of TelegramSyncService
    console.log('🔧 Initializing TelegramSyncService...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ TelegramSyncService initialized');
    
    // Test getting files from the archive channel
    console.log('\n📚 Getting files from "Архив для фантастики" channel...');
    const files = await syncService.downloadAndProcessFilesDirectly(10); // Get 10 files for testing
    
    console.log(`\n📊 Found ${files.length} files:`);
    
    // Display file information
    for (const file of files) {
      if (file.success) {
        console.log(`\n📁 File: ${file.filename}`);
        console.log(`   Message ID: ${file.messageId}`);
        console.log(`   Size: ${file.fileSize} bytes`);
        
        // Extract metadata from filename
        const { author, title } = TelegramSyncService.extractMetadataFromFilename(file.filename as string);
        console.log(`   Extracted - Author: ${author}`);
        console.log(`   Extracted - Title: ${title}`);
      } else {
        console.log(`\n❌ Failed to process file: ${file.messageId}`);
        console.log(`   Error: ${file.error}`);
      }
    }
    
    console.log('\n✅ Actual file processing test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
testActualFileProcessing().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});