/**
 * Debug script to understand data linking between telegram_messages_index and books
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ygqyswivvdtpgpnxrpzl.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncXlzd2l2dmR0cGdwbnhycHpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg2ODY3NCwiZXhwIjoyMDc0NDQ0Njc0fQ.O1K3gUEr5Hjxy1Wwdt7oSU2-qQ6vYkmS1i70X51OvxY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function debugDataLinking() {
  console.log('🔍 Отладка связи данных между таблицами...');
  console.log('========================================');

  try {
    // 1. Посмотрим на примеры из индекса
    console.log('\n📊 1. Примеры записей из telegram_messages_index...');
    const { data: indexExamples, error: indexExamplesError } = await supabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .not('author', 'is', null)
      .not('title', 'is', null)
      .limit(5);

    if (indexExamplesError) {
      console.error('❌ Ошибка при получении примеров из индекса:', indexExamplesError);
      return;
    }

    console.log('Примеры из индекса:');
    indexExamples?.forEach((record: any, index: number) => {
      console.log(`  ${index + 1}. Message ID: ${record.message_id}`);
      console.log(`     Автор: "${record.author}"`);
      console.log(`     Название: "${record.title}"`);
    });

    // 2. Посмотрим на примеры из books
    console.log('\n📊 2. Примеры записей из books...');
    const { data: bookExamples, error: bookExamplesError } = await supabase
      .from('books')
      .select('telegram_post_id, author, title')
      .not('telegram_post_id', 'is', null)
      .limit(5);

    if (bookExamplesError) {
      console.error('❌ Ошибка при получении примеров из books:', bookExamplesError);
      return;
    }

    console.log('Примеры из books:');
    bookExamples?.forEach((record: any, index: number) => {
      console.log(`  ${index + 1}. Telegram Post ID: ${record.telegram_post_id}`);
      console.log(`     Автор: "${record.author}"`);
      console.log(`     Название: "${record.title}"`);
    });

    // 3. Проверим, есть ли пересечения по ID
    console.log('\n📊 3. Поиск пересечений по ID...');

    if (indexExamples && bookExamples) {
      const indexIds = new Set(indexExamples.map((record: any) => record.message_id));
      const bookIds = new Set(bookExamples.map((record: any) => record.telegram_post_id));

      const commonIds = Array.from(indexIds).filter(id => bookIds.has(id));

      console.log(`Message ID в индексе: ${Array.from(indexIds).join(', ')}`);
      console.log(`Telegram Post ID в books: ${Array.from(bookIds).join(', ')}`);
      console.log(`Общие ID: ${commonIds.length > 0 ? commonIds.join(', ') : 'нет'}`);

      if (commonIds.length === 0) {
        console.log('\n❌ Нет общих ID между таблицами!');
        console.log('Это объясняет, почему нет связанных записей.');
      }
    }

    // 4. Проверим диапазоны ID
    console.log('\n📊 4. Диапазоны ID...');

    const { data: maxIndexId, error: maxIndexError } = await supabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: false })
      .limit(1)
      .single();

    const { data: minIndexId, error: minIndexError } = await supabase
      .from('telegram_messages_index')
      .select('message_id')
      .order('message_id', { ascending: true })
      .limit(1)
      .single();

    const { data: maxBookId, error: maxBookError } = await supabase
      .from('books')
      .select('telegram_post_id')
      .not('telegram_post_id', 'is', null)
      .order('telegram_post_id', { ascending: false })
      .limit(1)
      .single();

    const { data: minBookId, error: minBookError } = await supabase
      .from('books')
      .select('telegram_post_id')
      .not('telegram_post_id', 'is', null)
      .order('telegram_post_id', { ascending: true })
      .limit(1)
      .single();

    if (!maxIndexError && !minIndexError) {
      console.log(`Диапазон message_id в индексе: ${minIndexId?.message_id} - ${maxIndexId?.message_id}`);
    }

    if (!maxBookError && !minBookError) {
      console.log(`Диапазон telegram_post_id в books: ${minBookId?.telegram_post_id} - ${maxBookId?.telegram_post_id}`);
    }

    console.log('\n✅ Отладка завершена');

  } catch (error) {
    console.error('❌ Критическая ошибка при отладке:', error);
  }
}

debugDataLinking();