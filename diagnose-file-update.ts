import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function diagnoseFileUpdate() {
  try {
    console.log('🔍 Диагностика проблемы с обновлением файлов...');
    
    // Получаем книги без файлов
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, publication_year')
      .is('file_url', null)
      .order('author', { ascending: true })
      .order('title', { ascending: true });

    if (booksError) {
      throw new Error(`Ошибка получения книг: ${booksError.message}`);
    }

    console.log(`📊 Всего книг без файлов: ${books?.length || 0}`);

    if (!books || books.length === 0) {
      console.log('❌ Нет книг без файлов');
      return;
    }

    // Проверяем первые 3 книги
    const testBooks = books.slice(0, 3);
    console.log(`\n📋 Тестирование обновления для ${testBooks.length} книг:`);

    for (let i = 0; i < testBooks.length; i++) {
      const book = testBooks[i];
      console.log(`\n--- Книга ${i + 1}/${testBooks.length} ---`);
      console.log(`📚 "${book.title}" - ${book.author} (ID: ${book.id})`);
      
      // Имитируем процесс поиска файлов
      console.log('🔍 Поиск подходящих файлов...');
      
      // Здесь должна быть логика поиска файлов, аналогичная используемой в FileSearchManager
      // Для диагностики просто покажем, что происходит
      
      // Получаем все файлы из telegram_files
      const { data: allFiles, error: filesError } = await supabase
        .from('telegram_files')
        .select('message_id, file_name, file_size, mime_type, caption, date')
        .limit(10);

      if (filesError) {
        console.error(`❌ Ошибка получения файлов: ${filesError.message}`);
        continue;
      }

      console.log(`📁 Всего файлов в Telegram: ${allFiles?.length || 0}`);
      
      // Показываем первые 3 файла
      if (allFiles && allFiles.length > 0) {
        console.log('📋 Первые 3 файла:');
        allFiles.slice(0, 3).forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.file_name || `Файл ${file.message_id}`} (${file.file_size || 'размер неизвестен'})`);
        });
      }
      
      // Имитируем задержку
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✅ Диагностика завершена');
    console.log('\n💡 Возможные причины проблемы с обновлением файлов:');
    console.log('1. Состояние компонента не обновляется корректно');
    console.log('2. Ключи для ререндера компонента не меняются');
    console.log('3. Асинхронные операции не завершаются в правильном порядке');
    console.log('4. Проблемы с управлением видимостью компонента');
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
    process.exit(1);
  }
}

diagnoseFileUpdate();