import { BookWormService } from '../lib/telegram/book-worm-service';
import { TelegramFileService } from '../lib/telegram/file-service';
import dotenv from 'dotenv';

dotenv.config();

async function testSpecificCases() {
  try {
    console.log('🔍 Тестирование конкретных случаев сопоставления...');
    
    // Тестовые случаи, которые мы хотим проверить
    const testCases = [
      {
        book: {
          title: "Цикл Черноязыкий",
          author: "Кристофер Бьюлман"
        },
        filename: "Кристофер_Сташефф_Чародейский_цикл.zip",
        shouldMatch: false,
        description: "Разные авторы - не должно совпадать"
      },
      {
        book: {
          title: "Чародейский цикл",
          author: "Кристофер Сташефф"
        },
        filename: "Кристофер_Сташефф_Чародейский_цикл.zip",
        shouldMatch: true,
        description: "Тот же автор и цикл - должно совпадать"
      },
      {
        book: {
          title: "Ночной Дозор",
          author: "Сергей Лукьяненко"
        },
        filename: "Лукьяненко_Сергей_Ночной_Дозор.fb2.zip",
        shouldMatch: true,
        description: "Тот же автор и книга - должно совпадать"
      }
    ];
    
    console.log('\n📋 Тестовые случаи:');
    console.log('=================');
    
    for (const [index, testCase] of testCases.entries()) {
      console.log(`\n${index + 1}. ${testCase.description}`);
      console.log(`   Книга: "${testCase.book.title}" автора ${testCase.book.author}`);
      console.log(`   Файл: ${testCase.filename}`);
      console.log(`   Ожидаемый результат: ${testCase.shouldMatch ? 'Совпадение' : 'Нет совпадения'}`);
    }
    
    // Для тестирования реальных файлов из Telegram, запустим ограниченный тест
    console.log('\n🚀 Запуск теста с реальными файлами из Telegram...');
    
    // Создаем экземпляр BookWormService
    const bookWorm = new BookWormService();
    
    // Получаем ограниченное количество файлов для тестирования
    console.log('\n📥 Получение списка файлов для тестирования...');
    
    // Инициализируем сервисы
    await bookWorm['initializeServices']();
    
    if (bookWorm['fileService']) {
      // Получаем ограниченное количество файлов (например, 5)
      const files = await bookWorm['fileService']['getFilesToProcess'](5);
      console.log(`✅ Получено ${files.length} файлов для тестирования`);
      
      // Показываем информацию о файлах
      console.log('\n📁 Файлы для тестирования:');
      files.forEach((file: any, index: number) => {
        console.log(`   ${index + 1}. ${file.filename} (ID: ${file.messageId})`);
      });
    }
    
    console.log('\n✅ Тестирование конкретных случаев завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании конкретных случаев:', error);
    process.exit(1);
  }
}

testSpecificCases();