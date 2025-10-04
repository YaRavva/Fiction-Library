/**
 * Тестовый скрипт для проверки загрузки файла с составным именем
 * Использует существующий файл из Telegram канала и проверяет корректность обработки составных имен
 *
 * Использование:
 * npx tsx src/scripts/test-composite-filename-upload.ts
 */

// Загружаем переменные окружения ПЕРВЫМ делом
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

import { TelegramSyncService } from '../lib/telegram/sync.js';
import { createClient } from '@supabase/supabase-js';

async function testCompositeFilenameUpload() {
  console.log('🚀 Запускаем тест загрузки файла с составным именем...\n');

  let syncService: TelegramSyncService | null = null;
  
  try {
    // Создаем клиент Supabase для проверки результатов
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Создаем экземпляр TelegramSyncService
    syncService = await TelegramSyncService.getInstance();
    
    console.log('✅ Telegram клиент инициализирован');
    
    // Показываем примеры составных имен для тестирования
    console.log('🔍 Тестирование извлечения метаданных из составных имен файлов:');
    
    const testFilenames = [
      'Вилма Кадлечкова - Мицелий.zip',
      'Владимир_Торин_и_Олег_Яковлев_Мистер_Вечный.zip',
      'Александр_и_Мария_Хроники_Звездного_Века.zip',
      'Оксфордский_цикл_Тени_Прошлого.zip'
    ];
    
    testFilenames.forEach(filename => {
      const metadata = TelegramSyncService.extractMetadataFromFilename(filename);
      console.log(`\nФайл: ${filename}`);
      console.log(`  Автор: ${metadata.author}`);
      console.log(`  Название: ${metadata.title}`);
    });
    
    // Тестируем загрузку одного файла из Telegram
    console.log('\n📥 Начинаем загрузку файла из Telegram...');
    const results = await syncService.downloadAndProcessFilesDirectly(1);
    
    console.log('\n📊 Результаты загрузки:');
    console.log(JSON.stringify(results, null, 2));
    
    if (results && results.length > 0) {
      const result = results[0];
      if (result.success) {
        console.log(`\n✅ Файл успешно загружен:`);
        console.log(`  Имя файла: ${result.filename}`);
        console.log(`  Размер: ${result.fileSize} байт`);
        console.log(`  URL: ${result.fileUrl}`);
        
        // Проверяем запись в базе данных
        console.log('\n🔍 Проверяем запись в базе данных...');
        
        const { data: book, error } = await supabase
          .from('books')
          .select('*')
          .eq('telegram_file_id', result.messageId.toString())
          .single();
          
        if (error) {
          console.warn('⚠️  Ошибка при получении записи книги:', error);
        } else if (book) {
          console.log('✅ Найдена запись книги в базе данных:');
          console.log(`  ID: ${book.id}`);
          console.log(`  Название: ${book.title}`);
          console.log(`  Автор: ${book.author}`);
          console.log(`  URL файла: ${book.file_url}`);
          console.log(`  Путь хранения: ${book.storage_path}`);
          console.log(`  Формат: ${book.file_format}`);
          console.log(`  Размер: ${book.file_size} байт`);
          console.log(`  Telegram ID: ${book.telegram_file_id}`);
          
          // Проверяем корректность извлечения метаданных
          console.log('\n🔍 Проверяем корректность извлечения метаданных:');
          const extractedMetadata = TelegramSyncService.extractMetadataFromFilename(result.filename);
          console.log(`  Извлеченные метаданные: автор="${extractedMetadata.author}", название="${extractedMetadata.title}"`);
          
          if (extractedMetadata.author === book.author && extractedMetadata.title === book.title) {
            console.log('✅ Метаданные извлечены корректно');
          } else {
            console.warn('⚠️  Метаданные извлечены некорректно');
            console.log(`  В базе: автор="${book.author}", название="${book.title}"`);
            console.log(`  Извлеченные: автор="${extractedMetadata.author}", название="${extractedMetadata.title}"`);
          }
          
          // Проверяем формат имени файла в хранилище
          console.log('\n🔍 Проверяем формат имени файла в хранилище:');
          const ext = path.extname(result.filename) || '.fb2';
          const expectedStorageName = `${book.telegram_file_id}${ext}`;
          console.log(`  Ожидаемое имя: ${expectedStorageName}`);
          console.log(`  Фактическое имя: ${book.storage_path}`);
          
          if (book.storage_path === expectedStorageName) {
            console.log('✅ Имя файла в хранилище сформировано корректно');
          } else {
            console.warn('⚠️  Имя файла в хранилище сформировано некорректно');
          }
        } else {
          console.warn('⚠️  Запись книги не найдена в базе данных');
        }
      } else {
        console.error('❌ Ошибка при загрузке файла:', result.error);
      }
    } else {
      console.log('ℹ️  Нет файлов для загрузки');
    }
    
    console.log('\n✅ Тест завершен успешно');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании загрузки файла:', error);
    process.exit(1);
  } finally {
    // Завершаем работу клиента
    if (syncService) {
      try {
        await syncService.shutdown();
        console.log('🔌 Telegram клиент отключен');
      } catch (shutdownError) {
        console.warn('⚠️  Ошибка при отключении Telegram клиента:', shutdownError);
      }
    }
    
    // Принудительное завершение процесса для предотвращения зависания
    console.log('🛑 Принудительное завершение процесса...');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запускаем тест
testCompositeFilenameUpload();