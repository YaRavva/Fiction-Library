// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

// Используем те же переменные окружения, что и в основном приложении
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют необходимые переменные окружения:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'не задан');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey || 'не задан');
  console.error('\nПожалуйста, убедитесь, что переменные окружения установлены.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSeriesForAllBooks() {
  try {
    console.log('🚀 Начинаем обработку всех книг в базе данных');
    
    // Получаем все книги из базы данных
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('*');
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError);
      return;
    }
    
    console.log(`📚 Найдено книг: ${books.length}`);
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Обрабатываем каждую книгу
    for (const book of books) {
      try {
        processed++;
        console.log(`\n📝 Обрабатываем книгу ${processed}/${books.length}: ${book.author} - ${book.title}`);
        
        // Проверяем, есть ли у книги состав (поле books как JSON)
        let bookComposition = null;
        try {
          // Пытаемся распарсить поле books как JSON
          if (typeof book.books === 'string') {
            bookComposition = JSON.parse(book.books);
          } else if (Array.isArray(book.books)) {
            bookComposition = book.books;
          }
        } catch (parseError) {
          // Если не удалось распарсить, пропускаем
          console.log(`  ℹ️  У книги нет состава (не удалось распарсить поле books)`);
          skipped++;
          continue;
        }
        
        // Проверяем, есть ли состав
        if (!bookComposition || !Array.isArray(bookComposition) || bookComposition.length === 0) {
          console.log(`  ℹ️  У книги нет состава`);
          skipped++;
          continue;
        }
        
        // Проверяем, привязана ли книга к серии
        if (book.series_id) {
          console.log(`  ℹ️  Книга уже привязана к серии`);
          skipped++;
          continue;
        }
        
        console.log(`  📚 У книги есть состав из ${bookComposition.length} книг, создаем серию...`);
        
        // Создаем серию
        const seriesData: any = {
          title: book.title,
          author: book.author,
          description: book.description || '',
          genres: book.genres || [],
          tags: book.tags || [],
          rating: book.rating || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          series_composition: bookComposition
        };
        
        // Добавляем обложку, если она есть
        if (book.cover_url) {
          seriesData.cover_url = book.cover_url;
        }
        
        // Добавляем telegram_post_id, если он есть
        if (book.telegram_post_id) {
          seriesData.telegram_post_id = book.telegram_post_id;
        }
        
        const { data: insertedSeries, error: seriesError } = await supabase
          .from('series')
          .insert(seriesData)
          .select()
          .single();
        
        if (seriesError) {
          console.warn(`  ⚠️  Ошибка при создании серии:`, seriesError);
          errors++;
          continue;
        }
        
        const newSeriesId = (insertedSeries as any).id;
        console.log(`  ✅ Серия создана: ${newSeriesId}`);
        
        // Привязываем книгу к серии
        const { error: updateError } = await supabase
          .from('books')
          .update({ series_id: newSeriesId })
          .eq('id', book.id);
        
        if (updateError) {
          console.warn(`  ⚠️  Ошибка при привязке книги к серии:`, updateError);
          errors++;
          continue;
        }
        
        console.log(`  ✅ Книга привязана к серии`);
        updated++;
      } catch (error) {
        console.error(`  ❌ Ошибка при обработке книги ${book.id}:`, error);
        errors++;
      }
    }
    
    console.log(`\n📊 Обработка завершена:`);
    console.log(`  - Обработано: ${processed}`);
    console.log(`  - Обновлено: ${updated}`);
    console.log(`  - Пропущено: ${skipped}`);
    console.log(`  - Ошибок: ${errors}`);
    
    console.log('\n✅ Скрипт завершен!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
createSeriesForAllBooks();