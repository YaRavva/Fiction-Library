import { MetadataParser } from '../lib/telegram/parser';

async function debugTelegramMessage() {
  try {
    console.log('🔍 Отладка парсинга сообщения Telegram');
    
    // Реальное сообщение из Telegram
    const telegramMessage = `Автор: Елизавета Дворецкая
Название: цикл Корабль во фьорде
Жанр: #фэнтези #приключенческое #романтическоефэнтези #морскиефэнтези #альтернативнаяистория #закончен
Рейтинг: 7.51 #выше7
Когда викинги приходят за тобой — не стоит сдаваться без боя. Тем более, если ты умеешь управлять огнём, и у тебя есть тайна происхождения, которую лучше скрывать. Но и в бега можно уйти, если повезёт. Главное — не утонуть в море, не сгореть в пламени и не влюбиться в человека, который может стать причиной твоей гибели. Или спасти тебя от неё.
Состав:
Корабль во фьорде (2018)
Пламя и вода (2019)
Пепел и лёд (2020)
Волна и прилив (2021)`;

    console.log('📝 Сообщение из Telegram:');
    console.log(telegramMessage);
    
    // Парсим сообщение
    const metadata = MetadataParser.parseMessage(telegramMessage);
    
    console.log('\n📊 Результат парсинга:');
    console.log('- Автор:', metadata.author);
    console.log('- Название:', metadata.title);
    console.log('- Жанры:', metadata.genres.join(', '));
    console.log('- Теги:', metadata.tags.join(', '));
    console.log('- Рейтинг:', metadata.rating);
    console.log('- Описание:', metadata.description);
    console.log('- Книги в составе:', metadata.books.length);
    
    if (metadata.books.length > 0) {
      console.log('\n📚 Книги в составе:');
      metadata.books.forEach((book, index) => {
        console.log(`  ${index + 1}. ${book.title} (${book.year})`);
      });
    }
    
    // Проверяем, есть ли слово "Состав:" в сообщении
    if (telegramMessage.includes('Состав:')) {
      console.log('\n✅ В сообщении есть слово "Состав:", серия должна быть создана');
    } else {
      console.log('\n❌ В сообщении нет слова "Состав:"');
    }
    
    console.log('\n✅ Отладка завершена!');
  } catch (error) {
    console.error('❌ Ошибка при отладке:', error);
  }
}

// Запускаем отладку
debugTelegramMessage();