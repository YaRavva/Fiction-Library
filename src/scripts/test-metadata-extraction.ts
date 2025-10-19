import { MetadataExtractionService } from '../lib/telegram/metadata-extraction-service';
import dotenv from 'dotenv';

dotenv.config();

async function testMetadataExtraction() {
  console.log('🔍 Testing metadata extraction from filenames...');
  
  // Тестовые имена файлов
  const testFiles = [
    "4018.zip",
    "2923.fb2",
    "2244.fb2",
    "2920.zip",
    "2919.zip",
    "Джеймс_Роллинс_Хроники_убийцы_богов.zip",
    "Мюррей_Лейнстер_Колониальная_служба_Сборник.fb2",
    "Айзек_Азимов_Основание.fb2",
    "Роберт_Хайнлайн_Чужак_в_чужой_стране.zip"
  ];
  
  console.log('\n=== METADATA EXTRACTION TESTS ===');
  
  for (let i = 0; i < testFiles.length; i++) {
    const fileName = testFiles[i];
    console.log(`\n--- Test ${i + 1} ---`);
    console.log(`📄 Filename: ${fileName}`);
    
    // Извлекаем метаданные
    const metadata = MetadataExtractionService.extractMetadataFromFilename(fileName);
    console.log(`✍️  Extracted author: ${metadata.author}`);
    console.log(`📘 Extracted title: ${metadata.title}`);
    
    // Извлекаем поисковые термины
    const searchTerms = MetadataExtractionService.extractSearchTerms(fileName);
    console.log(`🔍 Search terms: [${searchTerms.join(', ')}]`);
  }
  
  console.log('\n✅ Testing completed');
}

// Run the test
testMetadataExtraction().catch(console.error);