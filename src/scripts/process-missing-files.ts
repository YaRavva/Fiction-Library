import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

import { TelegramFileService } from '../lib/telegram/file-service';
import { serverSupabase } from '../lib/serverSupabase';

interface Book {
    id: string;
    title: string;
    author: string;
    telegram_post_id: string;
}

async function processMissingFiles() {
    console.log('🔄 Обработка недостающих файлов...');
    
    try {
        // Получаем все книги, у которых есть telegram_post_id, но отсутствует telegram_file_id
        const { data: booksWithoutFiles, error } = await serverSupabase
            .from('books')
            .select('id, title, author, telegram_post_id')
            .not('telegram_post_id', 'is', null)
            .is('telegram_file_id', null);
            
        if (error) {
            console.error('❌ Ошибка при получении книг:', error);
            return;
        }
        
        console.log(`📊 Найдено ${booksWithoutFiles?.length || 0} книг без файлов`);
        
        if (!booksWithoutFiles || booksWithoutFiles.length === 0) {
            console.log('✅ Все книги имеют соответствующие файлы');
            return;
        }
        
        // Получаем экземпляр TelegramFileService
        const fileService = await TelegramFileService.getInstance();
        
        // Обрабатываем первые 5 книг без файлов
        const booksToProcess = booksWithoutFiles.slice(0, 5);
        console.log(`\n🔄 Обработка первых ${booksToProcess.length} книг...`);
        
        for (const book of booksToProcess) {
            const typedBook = book as Book;
            console.log(`\n📖 Обработка книги: "${typedBook.title}" автора ${typedBook.author} (ID: ${typedBook.id})`);
            console.log(`  📧 Telegram post ID: ${typedBook.telegram_post_id}`);
            
            try {
                // Пытаемся обработать файл по ID сообщения
                console.log(`  ⬇️  Попытка обработки файла...`);
                const result = await fileService.processSingleFileById(parseInt(typedBook.telegram_post_id, 10));
                
                if (result.success) {
                    console.log(`  ✅ Файл успешно обработан`);
                    if (result.filename) {
                        console.log(`  📄 Имя файла: ${result.filename}`);
                    }
                    if (result.fileSize) {
                        console.log(`  💾 Размер файла: ${result.fileSize} байт`);
                    }
                } else {
                    console.log(`  ⚠️  Файл не обработан: ${result.reason || 'Неизвестная причина'}`);
                }
            } catch (error) {
                console.error(`  ❌ Ошибка при обработке файла:`, error);
            }
        }
    } catch (error) {
        console.error('❌ Общая ошибка:', error);
    } finally {
        // Завершаем работу сервиса
        try {
            const fileService = await TelegramFileService.getInstance();
            await fileService.shutdown();
            console.log('\n🔌 Сервис завершен');
        } catch (shutdownError) {
            console.error('⚠️ Ошибка при завершении сервиса:', shutdownError);
        }
    }
}

// Запуск скрипта
processMissingFiles().catch(console.error);