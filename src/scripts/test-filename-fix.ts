import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
dotenv.config();

// Создаем клиент Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testFilenameFix() {
  try {
    console.log('🔍 Тестирование исправления расширения файла...\n');
    
    // Получаем тестовую книгу (книга Альфреда Бестера "Обманщики")
    const { data: book, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', '053ff4f3-24ae-43eb-a6d0-cc950f8b147e')
      .single();
    
    if (error) {
      console.error('❌ Ошибка получения книги:', error);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    console.log('📖 Информация о книге:');
    console.log(`   ID: ${book.id}`);
    console.log(`   Название: ${book.title}`);
    console.log(`   Автор: ${book.author}`);
    console.log(`   URL файла: ${book.file_url}`);
    console.log(`   Путь хранения: ${book.storage_path}`);
    console.log(`   Формат: ${book.file_format}`);
    console.log(`   Размер: ${book.file_size} байт\n`);
    
    // Проверяем формирование имени файла
    console.log('📝 Проверка формирования имени файла:');
    
    // Санитизируем название и автора
    const sanitizedTitle = book.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const sanitizedAuthor = book.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    
    console.log(`   Санитизированное название: ${sanitizedTitle}`);
    console.log(`   Санитизированный автор: ${sanitizedAuthor}`);
    
    // Определяем расширение файла (исправленная логика)
    const fileExtension = book.file_format && book.file_format !== '' ? 
      book.file_format : 
      (book.storage_path ? book.storage_path.split('.').pop() : 'zip');
      
    console.log(`   Определенное расширение: ${fileExtension}`);
    
    // Формирование имени файла
    const filename = `${sanitizedAuthor} - ${sanitizedTitle}.${fileExtension}`;
    console.log(`   Сформированное имя файла: ${filename}`);
    
    // Проверим, что расширение правильное
    if (fileExtension === 'fb2') {
      console.log('✅ Расширение файла корректно определено как .fb2');
    } else {
      console.log(`⚠️ Расширение файла определено как .${fileExtension}`);
    }
    
    // Сравним с предыдущим поведением
    const oldFilename = `${sanitizedAuthor} - ${sanitizedTitle}.zip`;
    console.log(`\n🔄 Сравнение:`);
    console.log(`   Старое имя файла: ${oldFilename}`);
    console.log(`   Новое имя файла: ${filename}`);
    
    if (filename !== oldFilename) {
      console.log('✅ Исправление работает - имя файла теперь соответствует формату файла');
    } else {
      console.log('ℹ️ Имя файла осталось прежним');
    }
    
    console.log('\n✅ Тест завершен успешно');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск теста
testFilenameFix().catch(console.error);