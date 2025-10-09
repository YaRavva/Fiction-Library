/**
 * Script to check completeness and accuracy between telegram_messages_index and books tables
 * This script verifies if all indexed messages have corresponding books and if metadata matches
 */

import { serverSupabase } from '../lib/serverSupabase';

async function checkDataCompletenessAndAccuracy() {
  console.log('🔍 Проверка полноты и точности данных между таблицами...');
  console.log('================================================');

  try {
    // 1. Проверка полноты: записи в telegram_messages_index без соответствия в books
    console.log('\n📊 1. Проверка полноты данных...');
    console.log('Поиск записей в telegram_messages_index без соответствия в books');

    // Сначала получим все message_id из telegram_messages_index
    const { data: allIndexed, error: indexedError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id');

    if (indexedError) {
      console.error('❌ Ошибка при получении данных из telegram_messages_index:', indexedError);
      return;
    }

    // Получим все telegram_post_id из books
    const { data: allBooks, error: booksError } = await serverSupabase
      .from('books')
      .select('telegram_post_id')
      .not('telegram_post_id', 'is', null);

    if (booksError) {
      console.error('❌ Ошибка при получении данных из books:', booksError);
      return;
    }

    // Найдем message_id, которые есть в индексе, но отсутствуют в books
    const indexedIds = new Set(allIndexed?.map((item: any) => item.message_id) || []);
    const bookIds = new Set(allBooks?.map((item: any) => item.telegram_post_id) || []);

    const missingIds = Array.from(indexedIds).filter(id => !bookIds.has(id));

    // Получим детальную информацию о недостающих записях
    const { data: missingBooks, error: missingError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .in('message_id', missingIds);

    if (missingError) {
      console.error('❌ Ошибка при проверке полноты:', missingError);
      return;
    }

    console.log(`Найдено ${missingBooks?.length || 0} записей в индексе без соответствия в books:`);
    if (missingBooks && missingBooks.length > 0) {
      missingBooks.slice(0, 10).forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. Message ID: ${record.message_id}`);
        console.log(`     Автор: ${record.author || 'не указан'}`);
        console.log(`     Название: ${record.title || 'не указано'}`);
      });

      if (missingBooks.length > 10) {
        console.log(`  ... и еще ${missingBooks.length - 10} записей`);
      }
    }

    // 2. Проверка точности: несоответствия в метаданных
    console.log('\n📊 2. Проверка точности данных...');
    console.log('Поиск несоответствий в метаданных между связанными записями');

    // Получим связанные записи с помощью JOIN через rpc или отдельные запросы
    const { data: indexRecords, error: indexError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .not('author', 'is', null)
      .not('title', 'is', null);

    if (indexError) {
      console.error('❌ Ошибка при получении данных из telegram_messages_index:', indexError);
      return;
    }

    const { data: bookRecords, error: bookError } = await serverSupabase
      .from('books')
      .select('telegram_post_id, author, title')
      .not('telegram_post_id', 'is', null);

    if (bookError) {
      console.error('❌ Ошибка при получении данных из books:', bookError);
      return;
    }

    // Найдем несоответствия
    const mismatchedRecords: any[] = [];
    indexRecords?.forEach((indexRecord: any) => {
      const bookRecord = bookRecords?.find((book: any) => book.telegram_post_id === indexRecord.message_id);
      if (bookRecord &&
          (indexRecord.author !== bookRecord.author || indexRecord.title !== bookRecord.title)) {
        mismatchedRecords.push({
          message_id: indexRecord.message_id,
          index_author: indexRecord.author,
          index_title: indexRecord.title,
          book_author: bookRecord.author,
          book_title: bookRecord.title
        });
      }
    });

    console.log(`Найдено ${mismatchedRecords?.length || 0} записей с несоответствиями в метаданных:`);
    if (mismatchedRecords && mismatchedRecords.length > 0) {
      mismatchedRecords.slice(0, 10).forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. Message ID: ${record.message_id}`);
        console.log(`     В индексе - Автор: "${record.author}", Название: "${record.title}"`);
        console.log(`     В books   - Автор: "${record.books.author}", Название: "${record.books.title}"`);
        console.log('');
      });

      if (mismatchedRecords.length > 10) {
        console.log(`  ... и еще ${mismatchedRecords.length - 10} записей`);
      }
    }

    // 3. Общая статистика
    console.log('\n📊 3. Общая статистика...');

    const { count: totalIndexed, error: totalIndexedError } = await serverSupabase
      .from('telegram_messages_index')
      .select('*', { count: 'exact', head: true });

    const { count: totalBooks, error: totalBooksError } = await serverSupabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_post_id', 'is', null);

    // Подсчитаем количество связанных записей
    const matchedCount = indexRecords?.filter((indexRecord: any) =>
      bookRecords?.some((book: any) => book.telegram_post_id === indexRecord.message_id)
    ).length || 0;

    if (totalIndexedError || totalBooksError) {
      console.error('❌ Ошибка при получении статистики');
      return;
    }

    console.log(`Общее количество записей в telegram_messages_index: ${totalIndexed || 0}`);
    console.log(`Общее количество книг с telegram_post_id в books: ${totalBooks || 0}`);
    console.log(`Количество связанных записей (индекс + книги): ${matchedCount}`);
    console.log(`Записей в индексе без соответствия в books: ${totalIndexed ? totalIndexed - matchedCount : 0}`);

    // 4. Процент соответствия
    const completenessPercentage = totalIndexed ? (matchedCount / totalIndexed * 100).toFixed(2) : '0.00';
    console.log(`Процент полноты соответствия: ${completenessPercentage}%`);

    console.log('\n✅ Проверка завершена');

  } catch (error) {
    console.error('❌ Критическая ошибка при выполнении проверки:', error);
    process.exit(1);
  }
}

// Запуск проверки
checkDataCompletenessAndAccuracy();