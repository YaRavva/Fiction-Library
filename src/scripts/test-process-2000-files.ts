import { FileProcessingService } from '../lib/telegram/file-processing-service';
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { serverSupabase } from '../lib/serverSupabase';

// Создаем S3 клиент для проверки существующих файлов
const createS3Client = () => new S3Client({
  endpoint: "https://s3.cloud.ru",
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

async function testProcess2000Files() {
  let s3Client: S3Client | null = null;
  
  try {
    console.log('🔍 Testing processing of files from Telegram...');
    
    // Initialize the Telegram file service
    const fileService = await FileProcessingService.getInstance();
    console.log('✅ TelegramFileService initialized');
    
    // Create S3 client
    s3Client = createS3Client();
    console.log('✅ S3 client initialized');
    
    // Process only 10 files directly (without queue)
    console.log('📚 Processing 10 files from Telegram channel...');
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
          console.log(`  📊 Счет: ${r.score}`);
        }
        console.log('');
      });
    }
    
    const skipped = results.filter((r: any) => r.success && r.skipped).length;
    const failed = results.filter((r: any) => !r.success).length;
    
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
testProcess2000Files();