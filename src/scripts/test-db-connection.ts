/**
 * Simple test script to check database connection and basic queries
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ygqyswivvdtpgpnxrpzl.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncXlzd2l2dmR0cGdwbnhycHpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg2ODY3NCwiZXhwIjoyMDc0NDQ0Njc0fQ.O1K3gUEr5Hjxy1Wwdt7oSU2-qQ6vYkmS1i70X51OvxY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testConnection() {
  console.log('🔍 Тестирование подключения к базе данных...');

  try {
    // Тест 1: Подсчет записей в telegram_messages_index
    console.log('\n📊 1. Подсчет записей в telegram_messages_index...');
    const { count: indexCount, error: indexError } = await supabase
      .from('telegram_messages_index')
      .select('*', { count: 'exact', head: true });

    if (indexError) {
      console.error('❌ Ошибка при запросе telegram_messages_index:', indexError);
    } else {
      console.log(`✅ Найдено ${indexCount} записей в telegram_messages_index`);
    }

    // Тест 2: Подсчет записей в books с telegram_post_id
    console.log('\n📊 2. Подсчет книг с telegram_post_id...');
    const { count: booksCount, error: booksError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_post_id', 'is', null);

    if (booksError) {
      console.error('❌ Ошибка при запросе books:', booksError);
    } else {
      console.log(`✅ Найдено ${booksCount} книг с telegram_post_id`);
    }

    // Тест 3: Пример записей из telegram_messages_index
    console.log('\n📊 3. Пример записей из telegram_messages_index...');
    const { data: sampleIndex, error: sampleIndexError } = await supabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .limit(5);

    if (sampleIndexError) {
      console.error('❌ Ошибка при получении примеров из telegram_messages_index:', sampleIndexError);
    } else {
      console.log('✅ Примеры записей:');
      sampleIndex?.forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${record.message_id}, Автор: ${record.author || 'не указан'}, Название: ${record.title || 'не указано'}`);
      });
    }

    // Тест 4: Пример записей из books
    console.log('\n📊 4. Пример записей из books...');
    const { data: sampleBooks, error: sampleBooksError } = await supabase
      .from('books')
      .select('telegram_post_id, author, title')
      .not('telegram_post_id', 'is', null)
      .limit(5);

    if (sampleBooksError) {
      console.error('❌ Ошибка при получении примеров из books:', sampleBooksError);
    } else {
      console.log('✅ Примеры книг:');
      sampleBooks?.forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. Post ID: ${record.telegram_post_id}, Автор: ${record.author || 'не указан'}, Название: ${record.title || 'не указано'}`);
      });
    }

    console.log('\n✅ Тестирование завершено');

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  }
}

testConnection();