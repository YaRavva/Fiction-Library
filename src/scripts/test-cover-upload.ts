/**
 * Тестовый скрипт для проверки загрузки обложек из Telegram в Supabase Storage
 * 
 * Использование:
 * npx tsx src/scripts/test-cover-upload.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { TelegramSyncService } from '@/lib/telegram/sync';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testCoverUpload() {
  console.log('🧪 Тестирование загрузки обложек из Telegram...\n');

  // Проверяем переменные окружения
  const requiredEnvVars = [
    'TELEGRAM_API_ID',
    'TELEGRAM_API_HASH',
    'TELEGRAM_SESSION',
    'TELEGRAM_METADATA_CHANNEL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Отсутствуют переменные окружения:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    process.exit(1);
  }

  console.log('✅ Все переменные окружения установлены\n');

  try {
    // Инициализируем сервис синхронизации
    console.log('📡 Подключаемся к Telegram...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Подключение установлено\n');

    // Синхронизируем 3 сообщения для теста
    console.log('📚 Получаем 3 последних сообщения с обложками...\n');
    const metadata = await syncService.syncMetadata(3);

    console.log(`\n📊 Результаты синхронизации:\n`);
    console.log(`Всего обработано сообщений: ${metadata.length}\n`);

    metadata.forEach((book, index) => {
      console.log(`📖 Книга ${index + 1}:`);
      console.log(`   Автор: ${book.author}`);
      console.log(`   Название: ${book.title}`);
      console.log(`   Жанры: ${book.genres.join(', ')}`);
      console.log(`   Рейтинг: ${book.rating}`);
      
      if (book.coverUrls && book.coverUrls.length > 0) {
        console.log(`   ✅ Обложки (${book.coverUrls.length}):`);
        book.coverUrls.forEach((url, i) => {
          console.log(`      ${i + 1}. ${url}`);
        });
      } else {
        console.log(`   ⚠️ Обложки не найдены`);
      }
      console.log('');
    });

    // Подсчитываем статистику
    const booksWithCovers = metadata.filter(b => b.coverUrls && b.coverUrls.length > 0).length;
    const totalCovers = metadata.reduce((sum, b) => sum + (b.coverUrls?.length || 0), 0);

    console.log('📈 Статистика:');
    console.log(`   Книг с обложками: ${booksWithCovers} из ${metadata.length}`);
    console.log(`   Всего обложек загружено: ${totalCovers}`);
    console.log('');

    if (totalCovers > 0) {
      console.log('✅ Тест успешно завершен! Обложки загружены в Supabase Storage.');
      console.log('\n💡 Проверьте bucket "covers" в Supabase Dashboard:');
      console.log(`   ${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('//', '//app.')}/project/_/storage/buckets/covers`);
    } else {
      console.log('⚠️ Обложки не были загружены. Возможные причины:');
      console.log('   1. Сообщения в Telegram не содержат изображений');
      console.log('   2. Ошибка при скачивании медиа из Telegram');
      console.log('   3. Ошибка при загрузке в Supabase Storage');
      console.log('\n💡 Проверьте логи выше для деталей.');
    }

    await syncService.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:', error);
    
    if (error instanceof Error) {
      console.error('\nДетали ошибки:', error.message);
      
      if (error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        console.error('\n💡 Убедитесь, что SUPABASE_SERVICE_ROLE_KEY установлен в .env файле');
      } else if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
        console.error('\n💡 Сессия Telegram устарела. Запустите:');
        console.error('   npx tsx src/scripts/telegram-login.ts');
      } else if (error.message.includes('storage')) {
        console.error('\n💡 Проверьте настройки Storage в Supabase Dashboard:');
        console.error('   1. Bucket "covers" создан');
        console.error('   2. Политики доступа настроены (см. docs/MIGRATION_006_COVERS.md)');
      }
    }
    
    process.exit(1);
  }
}

// Запускаем тест
testCoverUpload();

