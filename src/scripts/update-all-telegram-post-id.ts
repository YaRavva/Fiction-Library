import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function updateAllTelegramPostId() {
  const { getSupabaseAdmin } = await import('../lib/supabase');
  
  try {
    console.log('🚀 Начинаем обновление поля telegram_post_id для всех записей...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем все записи
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('id');
    
    if (fetchError) {
      throw new Error(`Ошибка получения записей: ${fetchError.message}`);
    }
    
    if (!books || books.length === 0) {
      console.log('ℹ️ Нет записей для обновления');
      return;
    }
    
    console.log(`📊 Найдено ${books.length} записей для обновления`);
    
    // Обновляем каждую запись, устанавливая пустую строку для telegram_post_id
    let updatedCount = 0;
    for (const book of books) {
      const { error: updateError } = await supabase
        .from('books')
        .update({
          telegram_post_id: ''
        })
        .eq('id', book.id);
      
      if (updateError) {
        console.error(`❌ Ошибка обновления записи ${book.id}: ${updateError.message}`);
      } else {
        updatedCount++;
      }
    }
    
    console.log(`✅ Обновлено ${updatedCount} из ${books.length} записей`);
  } catch (error) {
    console.error('❌ Ошибка обновления поля telegram_post_id:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

// Если скрипт запущен напрямую, выполняем обновление
if (require.main === module) {
  updateAllTelegramPostId()
    .then(() => {
      // Принудительно завершаем процесс через 1 секунду
      setTimeout(() => {
        console.log('🔒 Скрипт принудительно завершен');
        process.exit(0);
      }, 1000);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      // Принудительно завершаем процесс и в случае ошибки
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
}