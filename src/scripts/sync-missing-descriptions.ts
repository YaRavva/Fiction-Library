import { config } from 'dotenv';
import { resolve } from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';
import { getSupabaseAdmin } from '../lib/supabase';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

/**
 * Синхронизирует описания для книг, у которых они отсутствуют
 * @param limit Количество книг для обработки
 * @returns Результат синхронизации
 */
export async function syncMissingDescriptions(limit: number = 50) {
  try {
    console.log(`🚀 Запуск синхронизации описаний для книг без описаний (лимит: ${limit})`);
    
    // Получаем книги с пустыми описаниями, у которых есть telegram_file_id
    console.log('🔍 Получаем книги с пустыми описаниями и telegram_file_id...');
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // @ts-ignore
    const { data: booksWithoutDescriptions, error: fetchError } = await supabase
      .from('books')
      .select('*')
      .eq('description', '')
      .not('telegram_file_id', 'is', null)
      .limit(limit);
    
    if (fetchError) {
      throw new Error(`Ошибка получения книг без описаний: ${fetchError.message}`);
    }
    
    // Если не нашли книги с telegram_file_id, ищем все книги с пустыми описаниями
    if (!booksWithoutDescriptions || booksWithoutDescriptions.length === 0) {
      console.log('🔍 Не найдено книг с telegram_file_id, ищем все книги с пустыми описаниями...');
      // @ts-ignore
      const { data: allBooksWithoutDescriptions, error: allFetchError } = await supabase
        .from('books')
        .select('*')
        .eq('description', '')
        .limit(limit);
      
      if (allFetchError) {
        throw new Error(`Ошибка получения всех книг без описаний: ${allFetchError.message}`);
      }
      
      // Если и среди всех книг ничего не найдено, завершаем работу
      if (!allBooksWithoutDescriptions || allBooksWithoutDescriptions.length === 0) {
        console.log('✅ Нет книг с пустыми описаниями');
        return {
          success: true,
          message: 'Нет книг с пустыми описаниями',
          processed: 0,
          updated: 0,
          skipped: 0,
          errors: 0
        };
      }
      
      // Используем все книги с пустыми описаниями
      // @ts-ignore
      booksWithoutDescriptions = allBooksWithoutDescriptions;
    }
    
    console.log(`📊 Найдено ${booksWithoutDescriptions.length} книг с пустыми описаниями`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Обрабатываем каждую книгу
    for (const book of booksWithoutDescriptions) {
      try {
        const typedBook = book as any;
        console.log(`📝 Обрабатываем книгу: ${typedBook.author} - ${typedBook.title}`);
        
        // Проверяем, есть ли у книги telegram_file_id
        if (!typedBook.telegram_file_id) {
          console.log(`  ℹ️ У книги нет telegram_file_id, пропускаем`);
          skipped++;
          continue;
        }
        
        // Получаем сообщение из Telegram по ID
        console.log(`  📥 Получаем сообщение ${typedBook.telegram_file_id} из Telegram...`);
        const channel = await (syncService as any).telegramClient.getMetadataChannel();
        if (!channel) {
          throw new Error('Не удалось получить канал');
        }
        
        // Convert BigInteger to string for compatibility
        const channelId = typeof channel.id === 'object' && channel.id !== null ? 
          (channel.id as { toString: () => string }).toString() : 
          String(channel.id);
          
        const messages: any[] = await (syncService as any).telegramClient.getMessages(channelId, 1, parseInt(typedBook.telegram_file_id));
        if (!messages || messages.length === 0) {
          console.log(`  ℹ️ Сообщение не найдено, пропускаем`);
          skipped++;
          continue;
        }
        
        const msg = messages[0];
        const anyMsg = msg as unknown as { [key: string]: unknown };
        
        // Проверяем наличие текста в сообщении
        if (!anyMsg.message) {
          console.log(`  ℹ️ Сообщение не содержит текста, пропускаем`);
          skipped++;
          continue;
        }
        
        // Парсим текст сообщения для извлечения описания
        console.log(`  📄 Парсим текст сообщения для извлечения описания...`);
        const metadata = MetadataParser.parseMessage(anyMsg.message as string);
        
        // Проверяем, есть ли описание в метаданных
        if (!metadata.description || metadata.description.trim() === '') {
          console.log(`  ℹ️ Описание не найдено в сообщении, пропускаем`);
          skipped++;
          continue;
        }
        
        // Обновляем книгу с новым описанием
        console.log(`  🔄 Обновляем книгу с описанием...`);
        const updateData: any = { description: metadata.description };
        // @ts-ignore
        const { error: updateError } = await (supabase as any)
          .from('books')
          .update(updateData)
          .eq('id', typedBook.id);
        
        if (updateError) {
          console.error(`  ❌ Ошибка обновления книги:`, updateError);
          errors++;
        } else {
          console.log(`  ✅ Книга обновлена с описанием`);
          updated++;
        }
        
        processed++;
      } catch (error) {
        const typedBook = book as any;
        console.error(`❌ Ошибка обработки книги ${typedBook.author} - ${typedBook.title}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Синхронизация описаний завершена: ${processed} обработано, ${updated} обновлено, ${skipped} пропущено, ${errors} ошибок`);
    
    return {
      success: true,
      message: `Обработано ${processed} книг, обновлено ${updated} книг`,
      processed,
      updated,
      skipped,
      errors
    };
  } catch (error) {
    console.error('❌ Ошибка синхронизации описаний:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка синхронизации описаний',
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 1
    };
  }
}

// Если скрипт запущен напрямую, выполняем синхронизацию
if (require.main === module) {
  syncMissingDescriptions(50)
    .then(result => {
      console.log('Результат синхронизации описаний:', result);
      // Принудительно завершаем скрипт через 1 секунду
      setTimeout(() => {
        console.log('🔒 Скрипт принудительно завершен');
        process.exit(0);
      }, 1000);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      // Принудительно завершаем скрипт и в случае ошибки
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
}