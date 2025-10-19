import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function cleanupEmptyMetadataBooks() {
  try {
    console.log('🔍 Ищем книги с пустыми метаданными для удаления...');
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      console.error('❌ Не удалось создать клиент Supabase');
      return;
    }
    
    // Находим книги с пустыми авторами или названиями
    // @ts-ignore
    const { data: emptyMetadataBooks, error } = await supabase
      .from('books')
      .select('id, author, title, cover_url, telegram_post_id')
      .or('author.eq.,title.eq.')
      .limit(100); // Ограничиваем для безопасности
    
    if (error) {
      console.error('❌ Ошибка получения книг:', error.message);
      return;
    }
    
    console.log(`📚 Найдено книг с пустыми метаданными: ${emptyMetadataBooks?.length || 0}`);
    
    // Выводим несколько примеров
    if (emptyMetadataBooks && emptyMetadataBooks.length > 0) {
      console.log('\nПримеры книг с пустыми метаданными:');
      // @ts-ignore
      emptyMetadataBooks.slice(0, 10).forEach((book: any, index: number) => {
        console.log(`${index + 1}. ID: ${book.id}, Автор: "${book.author}", Название: "${book.title}", Telegram ID: ${book.telegram_post_id || 'Нет'}`);
      });
      
      // Подтверждение на удаление
      console.log(`\n⚠️  Будет удалено ${emptyMetadataBooks.length} записей с пустыми метаданными.`);
      console.log('Выполняем удаление...');
      
      // Удаляем книги с пустыми метаданными
      console.log('\n🗑️  Удаляем книги с пустыми метаданными...');
      
      // @ts-ignore
      const { error: deleteError } = await supabase
        .from('books')
        .delete()
        .or('author.eq.,title.eq.');
      
      if (deleteError) {
        console.error('❌ Ошибка удаления книг:', deleteError.message);
        return;
      }
      
      console.log(`✅ Удалено ${emptyMetadataBooks.length} записей с пустыми метаданными.`);
    } else {
      console.log('✅ Нет книг с пустыми метаданными для удаления.');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запускаем очистку
cleanupEmptyMetadataBooks();