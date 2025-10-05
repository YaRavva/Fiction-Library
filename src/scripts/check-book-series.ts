import { createClient } from '@supabase/supabase-js';

// Создаем клиент Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBookSeries() {
  try {
    console.log('🔍 Проверка создания серии для книги "цикл Корабль во фьорде"');
    
    // Ищем книгу в базе данных
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('*')
      .eq('title', 'цикл Корабль во фьорде')
      .eq('author', 'Елизавета Дворецкая');
    
    if (booksError) {
      console.error('❌ Ошибка при поиске книги:', booksError);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('❌ Книга не найдена в базе данных');
      return;
    }
    
    const book = books[0];
    console.log('📚 Найдена книга:');
    console.log('- ID:', book.id);
    console.log('- Название:', book.title);
    console.log('- Автор:', book.author);
    console.log('- Series ID:', book.series_id || 'не привязана к серии');
    
    // Если книга привязана к серии, проверяем серию
    if (book.series_id) {
      const { data: series, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .eq('id', book.series_id)
        .single();
      
      if (seriesError) {
        console.error('❌ Ошибка при поиске серии:', seriesError);
        return;
      }
      
      if (series) {
        console.log('\n📚 Найдена серия:');
        console.log('- ID:', series.id);
        console.log('- Название:', series.title);
        console.log('- Автор:', series.author);
        console.log('- Состав серии:', series.series_composition || 'пусто');
        
        if (series.series_composition && Array.isArray(series.series_composition)) {
          console.log('- Книги в составе:');
          series.series_composition.forEach((book: any, index: number) => {
            console.log(`  ${index + 1}. ${book.title} (${book.year})`);
          });
        }
      }
    } else {
      console.log('\nℹ️  Книга не привязана к серии. Проверим, существует ли серия с таким названием:');
      
      // Проверим, существует ли серия с таким названием
      const { data: seriesList, error: seriesListError } = await supabase
        .from('series')
        .select('*')
        .eq('title', 'цикл Корабль во фьорде')
        .eq('author', 'Елизавета Дворецкая');
      
      if (seriesListError) {
        console.error('❌ Ошибка при поиске серии:', seriesListError);
        return;
      }
      
      if (seriesList && seriesList.length > 0) {
        console.log('✅ Найдены серии с таким названием:');
        seriesList.forEach((series: any) => {
          console.log('- ID:', series.id);
          console.log('  Название:', series.title);
          console.log('  Состав серии:', series.series_composition || 'пусто');
        });
      } else {
        console.log('❌ Серии с таким названием не найдены');
      }
    }
    
    console.log('\n✅ Проверка завершена!');
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
  }
}

// Запускаем проверку
checkBookSeries();