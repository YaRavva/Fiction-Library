/**
 * Enhanced script to analyze data quality between telegram_messages_index and books tables
 * This script accounts for the fact that not all indexed posts contain books
 * and checks for potential duplicates
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ygqyswivvdtpgpnxrpzl.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncXlzd2l2dmR0cGdwbnhycHpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg2ODY3NCwiZXhwIjoyMDc0NDQ0Njc0fQ.O1K3gUEr5Hjxy1Wwdt7oSU2-qQ6vYkmS1i70X51OvxY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function analyzeDataQuality() {
  console.log('🔍 Анализ качества данных между таблицами...');
  console.log('===========================================');

  try {
    // 1. Общая статистика
    console.log('\n📊 1. Общая статистика...');

    const { count: totalIndexed, error: totalIndexedError } = await supabase
      .from('telegram_messages_index')
      .select('*', { count: 'exact', head: true });

    const { count: totalBooks, error: totalBooksError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_post_id', 'is', null);

    if (totalIndexedError || totalBooksError) {
      console.error('❌ Ошибка при получении общей статистики');
      return;
    }

    console.log(`Всего записей в telegram_messages_index: ${totalIndexed || 0}`);
    console.log(`Всего книг с telegram_post_id в books: ${totalBooks || 0}`);

    // 2. Анализ записей в индексе с метаданными книг
    console.log('\n📊 2. Анализ записей с метаданными книг...');

    const { data: indexWithBooks, error: indexWithBooksError } = await supabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .not('author', 'is', null)
      .not('title', 'is', null);

    if (indexWithBooksError) {
      console.error('❌ Ошибка при получении записей с метаданными:', indexWithBooksError);
      return;
    }

    const recordsWithBooks = indexWithBooks?.length || 0;
    console.log(`Записей в индексе с заполненными автором и названием: ${recordsWithBooks}`);

    // 3. Проверка соответствия между индексом и книгами
    console.log('\n📊 3. Проверка соответствия...');

    // Получим записи из индекса с метаданными
    const { data: indexRecords, error: indexRecordsError } = await supabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .not('author', 'is', null)
      .not('title', 'is', null);

    if (indexRecordsError) {
      console.error('❌ Ошибка при получении записей из индекса:', indexRecordsError);
      return;
    }

    // Получим книги с telegram_post_id
    const { data: bookRecords, error: bookRecordsError } = await supabase
      .from('books')
      .select('telegram_post_id, author, title')
      .not('telegram_post_id', 'is', null);

    if (bookRecordsError) {
      console.error('❌ Ошибка при получении книг:', bookRecordsError);
      return;
    }

    // Найдем связанные записи
    const linkedCount = indexRecords?.filter((indexRecord: any) =>
      bookRecords?.some((book: any) => book.telegram_post_id === indexRecord.message_id)
    ).length || 0;

    console.log(`Связанных записей (индекс + книги): ${linkedCount}`);

    // 4. Поиск несоответствий в метаданных
    console.log('\n📊 4. Поиск несоответствий в метаданных...');

    const mismatchedRecords: any[] = [];
    indexRecords?.forEach((indexRecord: any) => {
      const bookRecord = bookRecords?.find((book: any) => book.telegram_post_id === indexRecord.message_id);
      if (bookRecord && (indexRecord.author !== bookRecord.author || indexRecord.title !== bookRecord.title)) {
        mismatchedRecords.push({
          message_id: indexRecord.message_id,
          index_author: indexRecord.author,
          index_title: indexRecord.title,
          book_author: bookRecord.author,
          book_title: bookRecord.title
        });
      }
    });

    console.log(`Найдено несоответствий в метаданных: ${mismatchedRecords.length}`);
    if (mismatchedRecords.length > 0 && mismatchedRecords.length <= 10) {
      mismatchedRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. Message ID: ${record.message_id}`);
        console.log(`     В индексе - "${record.index_author}" - "${record.index_title}"`);
        console.log(`     В books   - "${record.book_author}" - "${record.book_title}"`);
      });
    }

    // 5. Анализ записей без метаданных книг
    console.log('\n📊 5. Анализ записей без метаданных книг...');

    const { data: recordsWithoutBooks, error: recordsWithoutBooksError } = await supabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .or('author.is.null,title.is.null');

    if (recordsWithoutBooksError) {
      console.error('❌ Ошибка при получении записей без метаданных:', recordsWithoutBooksError);
      return;
    }

    const recordsWithoutBooksCount = recordsWithoutBooks?.length || 0;
    console.log(`Записей в индексе без метаданных книг: ${recordsWithoutBooksCount}`);

    if (recordsWithoutBooks && recordsWithoutBooks.length <= 10) {
      recordsWithoutBooks.forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. Message ID: ${record.message_id}`);
        console.log(`     Автор: ${record.author || 'не указан'}, Название: ${record.title || 'не указано'}`);
      });
    }

    // 6. Проверка на дубликаты в индексе
    console.log('\n📊 6. Проверка на дубликаты в индексе...');

    const { data: allIndexRecords, error: allIndexError } = await supabase
      .from('telegram_messages_index')
      .select('message_id');

    if (allIndexError) {
      console.error('❌ Ошибка при получении всех записей индекса:', allIndexError);
      return;
    }

    const messageIds = allIndexRecords?.map((record: any) => record.message_id) || [];
    const uniqueMessageIds = new Set(messageIds);
    const duplicateCount = messageIds.length - uniqueMessageIds.size;

    console.log(`Общее количество записей в индексе: ${messageIds.length}`);
    console.log(`Уникальных message_id: ${uniqueMessageIds.size}`);
    console.log(`Количество дубликатов: ${duplicateCount}`);

    // 7. Итоговый анализ качества
    console.log('\n📊 7. Итоговый анализ качества данных...');
    console.log('=====================================');

    const validIndexRecords = totalIndexed ? totalIndexed - recordsWithoutBooksCount : 0;
    const completenessPercentage = validIndexRecords > 0 ? (linkedCount / validIndexRecords * 100).toFixed(2) : '0.00';

    console.log(`Записей в индексе с метаданными книг: ${validIndexRecords}`);
    console.log(`Из них связанных с книгами в books: ${linkedCount}`);
    console.log(`Процент полноты соответствия: ${completenessPercentage}%`);
    console.log(`Несоответствий в метаданных: ${mismatchedRecords.length}`);
    console.log(`Дубликатов в индексе: ${duplicateCount}`);

    // Рекомендации
    console.log('\n💡 Рекомендации:');
    if (parseFloat(completenessPercentage) < 80) {
      console.log('⚠️ Низкий процент полноты - рекомендуется проверить процесс синхронизации');
    }
    if (mismatchedRecords.length > 0) {
      console.log('⚠️ Найдены несоответствия в метаданных - требуется проверка алгоритма сопоставления');
    }
    if (duplicateCount > 0) {
      console.log('⚠️ Обнаружены дубликаты в индексе - рекомендуется очистка данных');
    }
    if (totalIndexed && recordsWithoutBooksCount > totalIndexed * 0.5) {
      console.log('ℹ️ Большое количество записей без метаданных - это нормально для индекса');
    }

    console.log('\n✅ Анализ завершен');

  } catch (error) {
    console.error('❌ Критическая ошибка при выполнении анализа:', error);
  }
}

analyzeDataQuality();