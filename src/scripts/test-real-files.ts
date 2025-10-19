import { TelegramFileService } from '../lib/telegram/file-service';

async function testRealFiles() {
  try {
    console.log('🔍 Testing real book files processing...');
    
    // Initialize the Telegram file service
    const fileService = await TelegramFileService.getInstance();
    console.log('✅ TelegramFileService initialized');
    
    // Process 5 files directly (without queue)
    console.log('📚 Processing 5 files from Telegram channel...');
    const results = await fileService.downloadAndProcessFilesDirectly(5);
    
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
          console.log(`  📊 Счет: ${r.score}`);
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
  } finally {
    // Принудительно завершаем процесс из-за известной проблемы с gramjs
    console.log('🛑 Принудительно завершаем процесс...');
    process.exit(0);
  }
}

// Run the test
testRealFiles();