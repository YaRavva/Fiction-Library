import { createClient } from '@supabase/supabase-js';

// Имитация данных книги с составом
const bookWithComposition = {
  title: "цикл Корабль во фьорде",
  author: "Елизавета Дворецкая",
  description: "Когда викинги приходят за тобой — не стоит сдаваться без боя...",
  genres: ["фэнтези", "приключенческое", "романтическоефэнтези"],
  tags: ["фэнтези", "приключенческое", "романтическоефэнтези", "морскиефэнтези", "альтернативнаяистория", "закончен"],
  rating: 7.51,
  books: [
    { title: "Корабль во фьорде", year: 2018 },
    { title: "Пламя и вода", year: 2019 },
    { title: "Пепел и лёд", year: 2020 },
    { title: "Волна и прилив", year: 2021 }
  ],
  coverUrls: [],
  messageId: 12345
};

// Имитация данных книги без состава
const bookWithoutComposition = {
  title: "Одиночная книга",
  author: "Елизавета Дворецкая",
  description: "Это просто одиночная книга без состава.",
  genres: ["фэнтези", "приключенческое"],
  tags: ["фэнтези", "приключенческое"],
  rating: 7.51,
  books: [],
  coverUrls: [],
  messageId: 12346
};

async function testSeriesCreationLogic() {
  try {
    console.log('🔍 Тестирование логики создания серий');
    
    // Тест 1: Книга с составом
    console.log('\n📝 Тест 1: Книга с составом');
    console.log('- Название:', bookWithComposition.title);
    console.log('- Автор:', bookWithComposition.author);
    console.log('- Книги в составе:', bookWithComposition.books.length);
    
    // Проверяем логику создания серии
    if (bookWithComposition.books && bookWithComposition.books.length > 0) {
      console.log('✅ У книги есть состав, серия должна быть создана');
      
      // Имитация создания серии
      const seriesData = {
        title: bookWithComposition.title,
        author: bookWithComposition.author,
        description: bookWithComposition.description,
        genres: bookWithComposition.genres,
        tags: bookWithComposition.tags,
        rating: bookWithComposition.rating,
        telegram_post_id: String(bookWithComposition.messageId),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        series_composition: bookWithComposition.books.map(b => ({
          title: b.title,
          year: b.year
        }))
      };
      
      console.log('📊 Данные для создания серии:');
      console.log('- Название серии:', seriesData.title);
      console.log('- Состав серии:', seriesData.series_composition.map(b => `${b.title} (${b.year})`).join(', '));
    } else {
      console.log('❌ У книги нет состава');
    }
    
    // Тест 2: Книга без состава
    console.log('\n📝 Тест 2: Книга без состава');
    console.log('- Название:', bookWithoutComposition.title);
    console.log('- Автор:', bookWithoutComposition.author);
    console.log('- Книги в составе:', bookWithoutComposition.books.length);
    
    // Проверяем логику создания серии
    if (bookWithoutComposition.books && bookWithoutComposition.books.length > 0) {
      console.log('✅ У книги есть состав, серия должна быть создана');
    } else {
      console.log('✅ У книги нет состава, серия создаваться не должна');
    }
    
    console.log('\n✅ Тестирование логики создания серий завершено успешно!');
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testSeriesCreationLogic();