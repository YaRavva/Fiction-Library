import { FileProcessingService } from '../lib/telegram/file-processing-service';

async function testFileProcessingLogic() {
  try {
    console.log('🔍 Testing file processing logic without downloading...');
    
    // Initialize the Telegram file service
    const fileService = await FileProcessingService.getInstance();
    console.log('✅ TelegramFileService initialized');
    
    // Process 10 random files directly (without queue)
    console.log('📚 Processing 10 random files from Telegram channel...');
    const results = await fileService.downloadAndProcessFilesDirectly(10);
    
    console.log(`\n📊 Results:`);
    console.log(`  Total processed: ${results.length}`);
    
    // Filter and display only successful matches with scores
    const successfulMatches = results.filter((r: any) => r.success && !r.skipped && r.bookTitle && r.bookAuthor);
    
    if (successfulMatches.length > 0) {
      console.log(`\n📋 Successful matches:`);
      successfulMatches.forEach((r: any) => {
        console.log(`  📄 ${r.filename}`);
        console.log(`  ✅ Выбрана лучшая книга: "${r.bookTitle}" автора ${r.bookAuthor}`);
        if (r.score !== undefined) {
          console.log(`  📊 Лучший счет: ${r.score}`);
        }
        console.log('');
      });
    }
    
    const skipped = results.filter((r: any) => r.success && r.skipped).length;
    const failed = results.filter((r: any) => !r.success).length;
    
    console.log(`  Successfully processed files: ${successfulMatches.length}`);
    console.log(`  Skipped files: ${skipped}`);
    console.log(`  Failed files: ${failed}`);
    
    console.log('\n✨ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  // Убрано принудительное завершение процесса
}

// Run the test
testFileProcessingLogic();