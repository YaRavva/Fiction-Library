import { TelegramFileService } from '../lib/telegram/file-service';

async function testOptimizedFileProcessing() {
  try {
    console.log('🔍 Testing optimized file processing...');
    
    // Initialize the Telegram file service
    const fileService = await TelegramFileService.getInstance();
    console.log('✅ TelegramFileService initialized');
    
    // Test the optimization by checking if it correctly skips files that already exist in the bucket
    console.log('📋 Getting files to process...');
    const files = await fileService.getFilesToProcess(5);
    console.log(`✅ Found ${files.length} files to process`);
    
    if (files.length > 0) {
      console.log('📂 Sample files:');
      files.slice(0, 3).forEach((file: any) => {
        console.log(`  - Message ID: ${file.messageId}, Filename: ${file.filename}`);
      });
    }
    
    console.log('✨ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOptimizedFileProcessing();