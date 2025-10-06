import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: '.env' });

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function clearBooksTelegramFileId() {
  console.log('Начинаем очистку поля telegram_file_id в таблице books...');
  
  try {
    // Сначала получаем количество записей, которые будут обновлены
    const { count, error: countError } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_file_id', 'is', null);
    
    if (countError) {
      console.error('Ошибка при подсчете записей:', countError);
      return;
    }
    
    console.log(`Найдено ${count} записей с заполненным полем telegram_file_id`);
    
    if (count && count > 0) {
      // Обновляем все записи, устанавливая telegram_file_id в null
      const { error } = await supabaseAdmin
        .from('books')
        .update({ telegram_file_id: null })
        .not('telegram_file_id', 'is', null);
      
      if (error) {
        console.error('Ошибка при очистке поля telegram_file_id:', error);
        return;
      }
      
      console.log(`✅ Успешно очищены ${count} записей с заполненным полем telegram_file_id`);
    } else {
      console.log('Нет записей для очистки');
    }
    
    console.log('Очистка завершена!');
  } catch (error) {
    console.error('Ошибка при выполнении скрипта:', error);
  }
}

// Выполняем скрипт
clearBooksTelegramFileId();