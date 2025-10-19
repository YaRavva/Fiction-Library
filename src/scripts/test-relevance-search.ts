import { TelegramFileService } from '../lib/telegram/file-service';
import dotenv from 'dotenv';

dotenv.config();

async function testRelevanceSearch() {
  try {
    console.log('🔍 Тестирование алгоритма релевантного поиска...');
    
    // Тестируем конкретный случай
    const testCases = [
      {
        book: {
          title: "Цикл Черноязыкий",
          author: "Кристофер Бьюлман"
        },
        filename: "Кристофер_Сташефф_Чародейский_цикл.zip",
        expectedMatch: false // Не должно совпадать
      },
      {
        book: {
          title: "Чародейский цикл",
          author: "Кристофер Сташефф"
        },
        filename: "Кристофер_Сташефф_Чародейский_цикл.zip",
        expectedMatch: true // Должно совпадать
      },
      {
        book: {
          title: "Цикл Великий Грайан",
          author: "Сергей Лукьяненко"
        },
        filename: "Лукьяненко_Сергей_Ночной_Дозор.fb2.zip",
        expectedMatch: false // Не должно совпадать
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📚 Тест: "${testCase.book.title}" автора ${testCase.book.author}`);
      console.log(`📁 Файл: ${testCase.filename}`);
      
      // Извлекаем метаданные из имени файла
      const metadata = TelegramFileService.extractMetadataFromFilename(testCase.filename);
      console.log(`📊 Извлеченные метаданные: автор="${metadata.author}", название="${metadata.title}"`);
      
      // Проверяем, должно ли быть совпадение
      const shouldMatch = testCase.expectedMatch;
      console.log(`🎯 Ожидаемое совпадение: ${shouldMatch ? 'ДА' : 'НЕТ'}`);
      
      // Здесь можно добавить дополнительную логику проверки
    }
    
    console.log('\n✅ Тестирование алгоритма завершено');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании алгоритма:', error);
    process.exit(1);
  }
}

testRelevanceSearch();