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

async function findMissingFiles() {
    console.log('🔍 Поиск книг без файлов...');
    
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
        
        // Получаем список файлов для обработки
        console.log('📥 Получаем список файлов из канала...');
        const filesToProcess = await fileService.getFilesToProcess(50); // Получаем первые 50 файлов
        console.log(`✅ Получено ${filesToProcess.length} файлов для анализа`);
        
        // Для каждой книги пытаемся найти соответствующий файл
        for (const book of booksWithoutFiles) {
            const typedBook = book as Book;
            console.log(`\n📖 Проверка книги: "${typedBook.title}" автора ${typedBook.author} (ID: ${typedBook.id})`);
            console.log(`  📧 Telegram post ID: ${typedBook.telegram_post_id}`);
            
            // Пытаемся найти соответствующий файл
            const matchingFile = filesToProcess.find(file => {
                // Простое сопоставление по ID сообщения
                return file.messageId?.toString() === typedBook.telegram_post_id;
            });
            
            if (matchingFile) {
                console.log(`  ✅ Найден соответствующий файл: ${matchingFile.filename}`);
                console.log(`  📝 Message ID файла: ${matchingFile.messageId}`);
                
                // Здесь можно добавить логику для обработки найденного файла
                // Например, вызов fileService.processSingleFileById(matchingFile.messageId);
            } else {
                console.log(`  ❌ Соответствующий файл не найден в первых 50 файлах`);
                
                // Попробуем извлечь метаданные из названия книги и найти совпадения
                const { author, title } = TelegramFileService.extractMetadataFromFilename(`${typedBook.author} - ${typedBook.title}`);
                console.log(`  🔍 Поиск по извлеченным метаданным: автор="${author}", название="${title}"`);
                
                // Поиск совпадений по названию и автору
                const potentialMatches = filesToProcess.filter(file => {
                    const filename = file.filename?.toString().toLowerCase() || '';
                    const titleMatch = filename.includes(title.toLowerCase().replace(/\s+/g, '_'));
                    const authorMatch = filename.includes(author.toLowerCase().replace(/\s+/g, '_'));
                    return titleMatch || authorMatch;
                });
                
                if (potentialMatches.length > 0) {
                    console.log(`  📚 Найдено ${potentialMatches.length} потенциальных совпадений:`);
                    for (const match of potentialMatches) {
                        console.log(`    - ${match.filename} (ID: ${match.messageId})`);
                    }
                } else {
                    console.log(`  ⚠️ Потенциальные совпадения не найдены`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Общая ошибка:', error);
    } finally {
        // Завершаем работу сервиса
        const fileService = await TelegramFileService.getInstance();
        await fileService.shutdown();
    }
}

// Запуск скрипта
findMissingFiles().catch(console.error);