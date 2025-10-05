/**
 * Скрипт для проверки содержимого Storage бакета
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function checkStorageFiles() {
  console.log('🔍 Проверка содержимого Storage бакета\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем список всех файлов в Storage
    console.log('📂 Получение списка файлов в Storage...');
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('books')
      .list('', { limit: 100 });
      
    if (storageError) {
      console.log('❌ Ошибка при получении списка файлов:', storageError.message);
      return;
    }
    
    console.log(`✅ Найдено файлов в Storage: ${storageFiles?.length || 0}`);
    
    if (storageFiles) {
      for (const file of storageFiles) {
        console.log(`  - ID: ${file.id}`);
        console.log(`    Name: "${file.name}"`);
        console.log(`    Updated: ${file.updated_at}`);
        console.log(`    Created: ${file.created_at}`);
        console.log('');
      }
    }
    
    console.log('✅ Проверка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
checkStorageFiles().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});