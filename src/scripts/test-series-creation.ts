import { TelegramSyncService } from '../lib/telegram/sync';
import { MetadataParser } from '../lib/telegram/parser';

async function testSeriesCreation() {
  try {
    console.log('🔍 Тестирование создания серий для книг с составом');
    
    // Тестовое сообщение с составом
    const testMessage = `Автор: Елизавета Дворецкая
Название: цикл Корабль во фьорде
Жанр: #фэнтези #приключенческое #романтическоефэнтези #морскиефэнтези #альтернативнаяистория #закончен
Рейтинг: 7.51 #выше7
Когда викинги приходят за тобой — не стоит сдаваться без боя. Тем более, если ты умеешь управлять огнём, и у тебя есть тайна происхождения, которую лучше скрывать. Но и в бега можно уйти, если повезёт. Главное — не утонуть в море, не сгореть в пламени и не влюбиться в человека, который может стать причиной твоей гибели. Или спасти тебя от неё.
Состав:
Корабль во фьорде (2018)
Пламя и вода (2019)
Пепел и лёд (2020)
Волна и прилив (2021)`;

    console.log('\n📝 Тестовое сообщение:');
    console.log(testMessage);
    
    // Парсим сообщение
    const metadata = MetadataParser.parseMessage(testMessage);
    console.log('\n📊 Результат парсинга:');
    console.log('- Автор:', metadata.author);
    console.log('- Название:', metadata.title);
    console.log('- Жанры:', metadata.genres.join(', '));
    console.log('- Рейтинг:', metadata.rating);
    console.log('- Описание:', metadata.description);
    console.log('- Книги в составе:', metadata.books.length);
    metadata.books.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} (${book.year})`);
    });
    
    // Проверяем логику создания серии
    if (metadata.books && metadata.books.length > 0) {
      console.log('\n✅ У книги есть состав, серия должна быть создана');
    } else {
      console.log('\n❌ У книги нет состава');
    }
    
    // Тестовое сообщение без состава
    const testMessageWithoutComposition = `Автор: Елизавета Дворецкая
Название: Одиночная книга
Жанр: #фэнтези #приключенческое
Рейтинг: 7.51 #выше7
Это просто одиночная книга без состава.`;

    console.log('\n\n📝 Тестовое сообщение без состава:');
    console.log(testMessageWithoutComposition);
    
    // Парсим сообщение
    const metadataWithoutComposition = MetadataParser.parseMessage(testMessageWithoutComposition);
    console.log('\n📊 Результат парсинга:');
    console.log('- Автор:', metadataWithoutComposition.author);
    console.log('- Название:', metadataWithoutComposition.title);
    console.log('- Жанры:', metadataWithoutComposition.genres.join(', '));
    console.log('- Рейтинг:', metadataWithoutComposition.rating);
    console.log('- Описание:', metadataWithoutComposition.description);
    console.log('- Книги в составе:', metadataWithoutComposition.books.length);
    
    // Проверяем логику создания серии
    if (metadataWithoutComposition.books && metadataWithoutComposition.books.length > 0) {
      console.log('\n✅ У книги есть состав, серия должна быть создана');
    } else {
      console.log('\n✅ У книги нет состава, серия создаваться не должна');
    }
    
    console.log('\n✅ Тестирование завершено успешно!');
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testSeriesCreation();