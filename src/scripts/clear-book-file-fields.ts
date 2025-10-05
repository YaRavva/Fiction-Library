import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

/**
 * Скрипт для очистки полей file_url, file_size, file_format, telegram_file_id и storage_path для всех книг
 */
export async function clearBookFileFields() {
  try {
    console.log('🚀 Начинаем очистку полей файлов для всех книг');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Сначала получаем все книги
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('id');
    
    if (fetchError) {
      throw new Error(`Ошибка получения записей: ${fetchError.message}`);
    }
    
    if (!books || books.length === 0) {
      console.log('ℹ️ Нет книг для обновления');
      return;
    }
    
    console.log(`📊 Найдено ${books.length} книг для обновления`);
    
    // Обновляем каждую запись по отдельности
    let updatedCount = 0;
    for (const book of books) {
      const { error: updateError } = await supabase
        .from('books')
        .update({
          file_url: null,
          file_size: null,
          file_format: null,
          telegram_file_id: null,
          storage_path: null
        })
        .eq('id', book.id);
      
      if (updateError) {
        console.error(`❌ Ошибка обновления книги ${book.id}: ${updateError.message}`);
      } else {
        updatedCount++;
      }
    }
    
    console.log(`✅ Обновлено ${updatedCount} из ${books.length} книг`);
  } catch (error) {
    console.error('❌ Ошибка очистки полей файлов:', error);
  }
}

// Если скрипт запущен напрямую, выполняем очистку
if (require.main === module) {
  clearBookFileFields()
    .then(() => {
      console.log('🔒 Скрипт завершен');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      process.exit(1);
    });
}