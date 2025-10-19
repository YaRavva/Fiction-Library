import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

dotenv.config();

async function checkBookRecord() {
  try {
    console.log('🔍 Проверяем запись о книге в базе данных...');
    
    // Ищем книгу по названию
    const { data, error } = await serverSupabase
      .from('books')
      .select('*')
      .eq('title', 'цикл Мицелий')
      .single();
    
    if (error) {
      console.error('❌ Ошибка при поиске книги:', error);
      return;
    }
    
    if (!data) {
      console.log('⚠️ Книга не найдена');
      return;
    }
    
    const book = data as any;
    
    console.log('✅ Найдена книга:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  URL файла: ${book.file_url}`);
    console.log(`  Путь в хранилище: ${book.storage_path}`);
    console.log(`  Размер файла: ${book.file_size}`);
    console.log(`  Формат файла: ${book.file_format}`);
    console.log(`  Telegram ID файла: ${book.telegram_file_id}`);
    
    // Проверяем, что URL файла использует прямую ссылку на S3
    if (book.file_url && book.file_url.includes('s3.cloud.ru')) {
      console.log('✅ URL файла использует прямую ссылку на S3');
      
      // Проверяем доступность файла
      console.log('🔍 Проверяем доступность файла по прямой ссылке...');
      try {
        const response = await fetch(book.file_url);
        if (response.ok) {
          console.log('✅ Файл доступен по прямой ссылке');
        } else {
          console.error(`❌ Файл недоступен. Статус: ${response.status} ${response.statusText}`);
        }
      } catch (fetchError) {
        console.error('❌ Ошибка при проверке доступности файла:', fetchError);
      }
    } else {
      console.log('⚠️ URL файла не использует прямую ссылку на S3');
    }
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

checkBookRecord();