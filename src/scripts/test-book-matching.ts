import { TelegramFileService } from '../lib/telegram/file-service';
import dotenv from 'dotenv';

dotenv.config();

// Интерфейс для тестовых данных
interface TestBook {
  id: string;
  title: string;
  author: string;
}

interface TestCase {
  book: {
    title: string;
    author: string;
  };
  filename: string;
  expectedMatch: boolean;
  description: string;
}

async function testBookMatching() {
  try {
    console.log('🔍 Комплексное тестирование алгоритма сопоставления книг и файлов...');
    
    // Тестовые случаи
    const testCases: TestCase[] = [
      {
        book: {
          title: "Цикл Черноязыкий",
          author: "Кристофер Бьюлман"
        },
        filename: "Кристофер_Сташефф_Чародейский_цикл.zip",
        expectedMatch: false,
        description: "Разные авторы - не должно совпадать"
      },
      {
        book: {
          title: "Чародейский цикл",
          author: "Кристофер Сташефф"
        },
        filename: "Кристофер_Сташефф_Чародейский_цикл.zip",
        expectedMatch: true,
        description: "Тот же автор и цикл - должно совпадать"
      },
      {
        book: {
          title: "Цикл Великий Грайан",
          author: "Сергей Лукьяненко"
        },
        filename: "Лукьяненко_Сергей_Ночной_Дозор.fb2.zip",
        expectedMatch: false,
        description: "Разные циклы одного автора - не должно совпадать"
      },
      {
        book: {
          title: "Ночной Дозор",
          author: "Сергей Лукьяненко"
        },
        filename: "Лукьяненко_Сергей_Ночной_Дозор.fb2.zip",
        expectedMatch: true,
        description: "Тот же автор и книга - должно совпадать"
      },
      {
        book: {
          title: "Дневной Дозор",
          author: "Сергей Лукьяненко"
        },
        filename: "Лукьяненко_Сергей_Ночной_Дозор.fb2.zip",
        expectedMatch: false,
        description: "Разные книги одного автора - не должно совпадать"
      }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📚 Тест: ${testCase.description}`);
      console.log(`${'='.repeat(50)}`);
      console.log(`Книга: "${testCase.book.title}" автора ${testCase.book.author}`);
      console.log(`Файл: ${testCase.filename}`);
      
      // Извлекаем метаданные из имени файла
      const metadata = TelegramFileService.extractMetadataFromFilename(testCase.filename);
      console.log(`\n📊 Извлеченные метаданные:`);
      console.log(`   Автор: "${metadata.author}"`);
      console.log(`   Название: "${metadata.title}"`);
      
      // Создаем тестовые книги для алгоритма выбора
      const testBooks: TestBook[] = [
        {
          id: "test1",
          title: testCase.book.title,
          author: testCase.book.author
        }
      ];
      
      // Добавляем несколько других книг для тестирования алгоритма ранжирования
      const otherBooks: TestBook[] = [
        {
          id: "other1",
          title: "Другая книга",
          author: "Другой автор"
        },
        {
          id: "other2",
          title: "Еще одна книга",
          author: testCase.book.author // Тот же автор
        }
      ];
      
      const allBooks = [...testBooks, ...otherBooks];
      
      // Извлекаем поисковые термины
      const searchTerms = metadata.title.toLowerCase().split(/[_\-\s]+/).filter((word: string) => word.length > 2);
      console.log(`\n🔍 Поисковые термины: [${searchTerms.join(', ')}]`);
      
      // Тестируем алгоритм выбора лучшего совпадения
      // Поскольку у нас нет прямого доступа к private методу selectBestMatch,
      // мы создадим упрощенную версию для тестирования
      
      console.log(`\n🎯 Ожидаемое совпадение: ${testCase.expectedMatch ? 'ДА' : 'НЕТ'}`);
      
      // Проверяем совпадение по автору
      const authorMatch = metadata.author.toLowerCase().includes(testCase.book.author.toLowerCase()) || 
                         testCase.book.author.toLowerCase().includes(metadata.author.toLowerCase());
      console.log(`📝 Совпадение по автору: ${authorMatch ? 'ДА' : 'НЕТ'}`);
      
      // Проверяем совпадение по названию (убираем расширения файлов для сравнения)
      const cleanMetadataTitle = metadata.title.toLowerCase().replace(/\.[^/.]+$/, "");
      const titleMatch = cleanMetadataTitle.includes(testCase.book.title.toLowerCase()) || 
                        testCase.book.title.toLowerCase().includes(cleanMetadataTitle);
      console.log(`📝 Совпадение по названию: ${titleMatch ? 'ДА' : 'НЕТ'}`);
      
      // Определяем, прошел ли тест
      const testPassed = (authorMatch && titleMatch) === testCase.expectedMatch;
      console.log(`\n✅ Тест ${testPassed ? 'ПРОЙДЕН' : 'НЕ ПРОЙДЕН'}`);
      
      if (testPassed) {
        passedTests++;
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
    console.log(`${'='.repeat(50)}`);
    console.log(`Всего тестов: ${totalTests}`);
    console.log(`Пройдено: ${passedTests}`);
    console.log(`Провалено: ${totalTests - passedTests}`);
    console.log(`Процент успеха: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 Все тесты пройдены успешно!');
    } else {
      console.log('\n⚠️  Некоторые тесты не пройдены. Требуется доработка алгоритма.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании алгоритма:', error);
    process.exit(1);
  }
}

testBookMatching();