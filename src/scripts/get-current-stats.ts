import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Инициализация Supabase клиента
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getCurrentStats() {
  console.log('📊 Получение актуальной статистики...');
  
  try {
    // Получаем количество книг в базе данных
    console.log('\n📚 Получение количества книг в базе данных...');
    const { count: booksInDatabase, error: booksCountError } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true });

    if (booksCountError) {
      console.error('❌ Ошибка при получении количества книг:', booksCountError);
      return;
    }

    console.log(`✅ Книг в базе данных: ${booksInDatabase || 0}`);

    // Получаем количество книг без файлов
    console.log('\n📁 Получение количества книг без файлов...');
    const { count: booksWithoutFiles, error: booksWithoutFilesError } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true })
      .is('file_url', null);

    if (booksWithoutFilesError) {
      console.error('❌ Ошибка при получении количества книг без файлов:', booksWithoutFilesError);
      return;
    }

    console.log(`✅ Книг без файлов: ${booksWithoutFiles || 0}`);

    // Получаем последнюю запись из таблицы telegram_stats
    console.log('\n📈 Получение последней записи из таблицы telegram_stats...');
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('telegram_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(1);

    if (statsError) {
      console.error('❌ Ошибка при получении статистики:', statsError);
      return;
    }

    let booksInTelegram = 0;
    let missingBooks = 0;
    
    if (stats && stats.length > 0) {
      const latestStats = stats[0];
      // Используем messages_processed как приблизительное количество книг в Telegram
      booksInTelegram = latestStats.messages_processed || 0;
      // Вычисляем отсутствующие книги
      missingBooks = Math.max(0, booksInTelegram - (booksInDatabase || 0));
      console.log(`✅ Использована статистика от ${latestStats.date}`);
    } else {
      // Если нет статистики, используем приблизительное значение
      booksInTelegram = Math.round((booksInDatabase || 0) * 1.2);
      missingBooks = Math.max(0, booksInTelegram - (booksInDatabase || 0));
      console.log('⚠️  Статистика отсутствует, использованы приблизительные значения');
    }

    // Выводим итоговые результаты
    console.log('\n📈 === АКТУАЛЬНАЯ СТАТИСТИКА ===');
    console.log(`📚 Книг в базе данных: ${booksInDatabase || 0}`);
    console.log(`📡 Книг в Telegram: ${booksInTelegram}`);
    console.log(`❌ Отсутствующих книг: ${missingBooks}`);
    console.log(`📁 Книг без файлов: ${booksWithoutFiles || 0}`);
    
    // Возвращаем данные в формате, ожидаемом админкой
    console.log('\n📤 Формат данных для админки:');
    console.log(JSON.stringify({
      booksInDatabase: booksInDatabase || 0,
      booksInTelegram: booksInTelegram,
      missingBooks: missingBooks,
      booksWithoutFiles: booksWithoutFiles || 0,
    }, null, 2));
    
    console.log('\n✅ Получение актуальной статистики завершено');
    
  } catch (error) {
    console.error('❌ Ошибка при получении актуальной статистики:', error);
  }
}

// Run the script
getCurrentStats().catch(console.error);