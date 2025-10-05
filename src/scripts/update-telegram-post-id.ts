import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function updateTelegramPostId() {
  try {
    console.log('🚀 Начинаем обновление поля telegram_post_id для всех записей');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем книги, у которых telegram_post_id пуст, но есть telegram_file_id
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('id, telegram_file_id')
      .is('telegram_post_id', null)
      .not('telegram_file_id', 'is', null);
    
    if (fetchError) {
      throw new Error(`Ошибка получения записей: ${fetchError.message}`);
    }
    
    if (!books || books.length === 0) {
      console.log('ℹ️ Нет записей для обновления');
      return;
    }
    
    console.log(`📊 Найдено ${books.length} записей для обновления`);
    
    // Обновляем каждую запись
    let updatedCount = 0;
    for (const book of books) {
      const { error: updateError } = await supabase
        .from('books')
        .update({
          telegram_post_id: book.telegram_file_id
        })
        .eq('id', book.id);
      
      if (updateError) {
        console.error(`❌ Ошибка обновления записи ${book.id}: ${updateError.message}`);
      } else {
        updatedCount++;
      }
    }
    
    console.log(`✅ Обновлено ${updatedCount} из ${books.length} записей`);
    
    // Теперь обновляем оставшиеся записи, у которых оба поля пусты
    console.log('🔍 Обновляем оставшиеся записи...');
    
    const { data: remainingBooks, error: fetchRemainingError } = await supabase
      .from('books')
      .select('id')
      .is('telegram_post_id', null);
    
    if (fetchRemainingError) {
      throw new Error(`Ошибка получения оставшихся записей: ${fetchRemainingError.message}`);
    }
    
    if (!remainingBooks || remainingBooks.length === 0) {
      console.log('ℹ️ Нет оставшихся записей для обновления');
      return;
    }
    
    console.log(`📊 Найдено ${remainingBooks.length} оставшихся записей для обновления`);
    
    // Для оставшихся записей устанавливаем telegram_post_id в пустую строку
    let remainingUpdatedCount = 0;
    for (const book of remainingBooks) {
      const { error: updateError } = await supabase
        .from('books')
        .update({
          telegram_post_id: ''
        })
        .eq('id', book.id);
      
      if (updateError) {
        console.error(`❌ Ошибка обновления записи ${book.id}: ${updateError.message}`);
      } else {
        remainingUpdatedCount++;
      }
    }
    
    console.log(`✅ Обновлено ${remainingUpdatedCount} из ${remainingBooks.length} оставшихся записей`);
  } catch (error) {
    console.error('❌ Ошибка обновления поля telegram_post_id:', error);
  }
}

// Если скрипт запущен напрямую, выполняем обновление
if (require.main === module) {
  updateTelegramPostId()
    .then(() => {
      console.log('🔒 Скрипт завершен');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      process.exit(1);
    });
}