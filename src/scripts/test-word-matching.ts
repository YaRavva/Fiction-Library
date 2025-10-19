import { MetadataExtractionService } from '../lib/telegram/metadata-extraction-service';

async function testWordMatching() {
  console.log('🔍 Testing word matching algorithm...');
  
  // Тестовый пример с 4 совпадающими словами
  console.log(`\n=== Тест: 4 совпадающих слова ===`);
  const testFileName = "Мюррей_Лейнстер_Колониальная_служба_Сборник.fb2";
  const testAuthor = "Мюррей Лейнстер";
  const testTitle = "Колониальная служба Сборник";
  
  console.log(`📄 Test file name: ${testFileName}`);
  console.log(`✍️  Extracted author: ${testAuthor}`);
  console.log(`📘 Extracted title: ${testTitle}`);
  
  // Имитация найденных совпадений
  const mockMatches = [
    {
      title: "Колониальная служба (1956)",
      author: "Мюррей Лейнстер"
    }
  ];
  
  // Извлекаем поисковые термины
  const searchTerms = MetadataExtractionService.extractSearchTerms(testFileName);
  console.log(`🔍 Search terms: [${searchTerms.join(', ')}]`);
  
  // Извлекаем слова из имени файла
  const fileNameWords = testTitle.toLowerCase().split(/[_\-\s]+/).filter(word => word.length > 2);
  console.log(`🔤 Words from filename: [${fileNameWords.join(', ')}]`);
  
  // Тестируем алгоритм ранжирования
  const bestMatch = MetadataExtractionService.selectBestMatch(
    mockMatches,
    searchTerms,
    testTitle,
    testAuthor
  );
  
  if (bestMatch) {
    console.log(`✅ Best match selected: "${(bestMatch as { title: string }).title}" by ${(bestMatch as { author: string }).author}`);
  } else {
    console.log('⚠️  No suitable match found');
  }
  
  // Тестовый пример с 5 совпадающими словами
  console.log(`\n=== Тест: 5 совпадающих слов ===`);
  const testFileName2 = "Джеймс_Роллинс_Хроники_убийцы_богов.zip";
  const testAuthor2 = "Джеймс Роллинс";
  const testTitle2 = "Хроники убийцы богов";
  
  console.log(`📄 Test file name: ${testFileName2}`);
  console.log(`✍️  Extracted author: ${testAuthor2}`);
  console.log(`📘 Extracted title: ${testTitle2}`);
  
  // Имитация найденных совпадений
  const mockMatches2 = [
    {
      title: "цикл Хроники убийцы богов",
      author: "Джеймс Роллинс [под псевдонимом Джеймс Клеменс]"
    }
  ];
  
  // Извлекаем поисковые термины
  const searchTerms2 = MetadataExtractionService.extractSearchTerms(testFileName2);
  console.log(`🔍 Search terms: [${searchTerms2.join(', ')}]`);
  
  // Извлекаем слова из имени файла
  const fileNameWords2 = testTitle2.toLowerCase().split(/[_\-\s]+/).filter(word => word.length > 2);
  console.log(`🔤 Words from filename: [${fileNameWords2.join(', ')}]`);
  
  // Тестируем алгоритм ранжирования
  const bestMatch2 = MetadataExtractionService.selectBestMatch(
    mockMatches2,
    searchTerms2,
    testTitle2,
    testAuthor2
  );
  
  if (bestMatch2) {
    console.log(`✅ Best match selected: "${(bestMatch2 as { title: string }).title}" by ${(bestMatch2 as { author: string }).author}`);
  } else {
    console.log('⚠️  No suitable match found');
  }
}

// Run the test
testWordMatching().catch(console.error);