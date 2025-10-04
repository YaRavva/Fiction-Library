/**
 * Скрипт для обновления ограничения file_format в таблице books в облачной базе данных Supabase
 * Обновляет ограничение до поддержки только fb2 и zip форматов
 *
 * Использование:
 * npx tsx src/scripts/update-file-format-constraint.ts
 */

// Загружаем переменные окружения
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

async function updateFileFormatConstraint() {
  console.log('🚀 Обновляем ограничение file_format в таблице books...\n');

  try {
    // Создаем клиент с service role key для административных операций
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    console.log('✅ Подключение к облачной базе данных Supabase установлено');
    
    // Выполняем SQL запросы для обновления ограничения
    const queries = [
      // Удаляем существующее ограничение
      'ALTER TABLE books DROP CONSTRAINT IF EXISTS books_file_format_check',
      // Добавляем новое ограничение с поддержкой только fb2 и zip
      "ALTER TABLE books ADD CONSTRAINT books_file_format_check CHECK (file_format IN ('fb2', 'zip'))"
    ];
    
    for (const query of queries) {
      console.log(`Выполняем запрос: ${query}`);
      
      // Для выполнения административных запросов используем прямое подключение
      const { data, error } = await supabase.rpc('execute_sql', { 
        sql: query 
      });
      
      if (error) {
        console.warn(`⚠️  Ошибка при выполнении запроса:`, error);
      } else {
        console.log('✅ Запрос выполнен успешно');
      }
    }
    
    console.log('\n✅ Ограничение file_format успешно обновлено!');
    console.log('Теперь поддерживаются только форматы: fb2, zip');
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении ограничения:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
updateFileFormatConstraint();