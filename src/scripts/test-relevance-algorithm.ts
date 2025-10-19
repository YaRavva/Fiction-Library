import { MetadataExtractionService } from '../lib/telegram/metadata-extraction-service';

async function testRelevanceAlgorithm() {
  console.log('🔍 Testing relevance algorithm...');
  
  // Тестовый пример из вашего запроса
  const testFileName = "Джеймс_Роллинс_Хроники_убийцы_богов.zip";
  const testAuthor = "Джеймс Роллинс";
  const testTitle = "Хроники убийцы богов";
  
  console.log(`\n=== Тест 1 ===`);
  console.log(`📄 Test file name: ${testFileName}`);
  console.log(`✍️  Extracted author: ${testAuthor}`);
  console.log(`📘 Extracted title: ${testTitle}`);
  
  // Имитация найденных совпадений
  const mockMatches1 = [
    {
      title: "цикл Хроники убийцы богов",
      author: "Джеймс Роллинс [под псевдонимом Джеймс Клеменс]"
    },
    {
      title: "цикл Отряд Сигма",
      author: "Джеймс Роллинс"
    },
    {
      title: "цикл Джейк Рэнсом",
      author: "Джеймс Роллинс"
    }
  ];
  
  // Извлекаем поисковые термины
  const searchTerms1 = MetadataExtractionService.extractSearchTerms(testFileName);
  console.log(`🔍 Search terms: [${searchTerms1.join(', ')}]`);
  
  // Тестируем алгоритм ранжирования
  const bestMatch1 = MetadataExtractionService.selectBestMatch(
    mockMatches1,
    searchTerms1,
    testTitle,
    testAuthor
  );
  
  if (bestMatch1) {
    console.log(`✅ Best match selected: "${(bestMatch1 as { title: string }).title}" by ${(bestMatch1 as { author: string }).author}`);
  } else {
    console.log('⚠️  No suitable match found');
  }
  
  // Второй тестовый пример
  console.log(`\n=== Тест 2 ===`);
  const testFileName2 = "Мюррей_Лейнстер_Колониальная_служба_Сборник.fb2";
  const testAuthor2 = "Мюррей Лейнстер";
  const testTitle2 = "Колониальная служба Сборник";
  
  console.log(`📄 Test file name: ${testFileName2}`);
  console.log(`✍️  Extracted author: ${testAuthor2}`);
  console.log(`📘 Extracted title: ${testTitle2}`);
  
  // Имитация найденных совпадений
  const mockMatches2 = [
    {
      title: "Колониальная служба (1956)",
      author: "Мюррей Лейнстер"
    },
    {
      title: "Колониальная служба: Конфликт миров (1960)",
      author: "Мюррей Лейнстер"
    },
    {
      title: "Поселенцы Альфа (1963)",
      author: "Мюррей Лейнстер"
    }
  ];
  
  // Извлекаем поисковые термины
  const searchTerms2 = MetadataExtractionService.extractSearchTerms(testFileName2);
  console.log(`🔍 Search terms: [${searchTerms2.join(', ')}]`);
  
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
testRelevanceAlgorithm().catch(console.error);