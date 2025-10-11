// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { TelegramService } from '../lib/telegram/client';
import { TelegramSyncService } from '../lib/telegram/sync';
import { getSupabaseAdmin } from '../lib/supabase';

// Функция для разбиения имени файла на слова
function extractWordsFromFilename(filename: string): string[] {
    // Убираем расширение файла
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    // Разбиваем на слова
    const words = nameWithoutExt
        .split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
        .filter(word => word.length > 1) // Убираем короткие слова
        .map(word => word.trim().toLowerCase()) // Приводим к нижнему регистру
        .filter(word => word.length > 0); // Убираем пустые слова

    return words;
}

// Функция для поиска книг по словам из имени файла
async function searchBooksByWords(admin: any, words: string[]) {
    if (words.length === 0) {
        return [];
    }
    
    // Ищем книги, где в названии или авторе встречаются слова из поискового запроса
    const searchPromises = words.map(async (word) => {
        const { data: titleMatches } = await (admin as any)
            .from('books')
            .select('id, title, author')
            .ilike('title', `%${word}%`)
            .limit(5);

        const { data: authorMatches } = await (admin as any)
            .from('books')
            .select('id, title, author')
            .ilike('author', `%${word}%`)
            .limit(5);

        const allMatches = [...(titleMatches || []), ...(authorMatches || [])];

        // Удаляем дубликаты по ID
        const uniqueMatches = allMatches.filter((book, index, self) =>
            index === self.findIndex(b => b.id === book.id)
        );

        return uniqueMatches;
    });

    // Выполняем все поисковые запросы параллельно
    const results = await Promise.all(searchPromises);

    // Объединяем все результаты
    const allMatches = results.flat();

    // Удаляем дубликаты по ID
    const uniqueMatches = allMatches.filter((book, index, self) =>
        index === self.findIndex(b => b.id === book.id)
    );

    // Сортируем по релевантности (по количеству совпадений)
    const matchesWithScores = uniqueMatches.map(book => {
        const bookTitleWords = book.title.toLowerCase().split(/\s+/);
        const bookAuthorWords = book.author.toLowerCase().split(/\s+/);
        const allBookWords = [...bookTitleWords, ...bookAuthorWords];

        // Считаем количество совпадений поисковых слов с словами в книге
        let score = 0;
        for (const searchWord of words) {
          const normalizedSearchWord = searchWord.toLowerCase();
          let found = false;
          for (const bookWord of allBookWords) {
            const normalizedBookWord = bookWord.toLowerCase();
            // Проверяем точное совпадение или частичное включение
            if (normalizedBookWord.includes(normalizedSearchWord) || normalizedSearchWord.includes(normalizedBookWord)) {
              score++;
              found = true;
              break; // Не увеличиваем счетчик больше одного раза для одного поискового слова
            }
          }
        }
        
        return { ...book, score };
    });

    // Сортируем по убыванию счета
    matchesWithScores.sort((a, b) => b.score - a.score);
    
    // Берем только лучшие совпадения и фильтруем по минимальной релевантности
    const topMatches = matchesWithScores.slice(0, 5);
    
    // Возвращаем только совпадения с релевантностью >= 2
    return topMatches.filter(match => match.score >= 2);
}

async function processHistoricalTelegramFiles() {
    console.log('=== ОБРАБОТКА ИСТОРИЧЕСКИХ ФАЙЛОВ ИЗ TELEGRAM ===\n');

    let client: TelegramService | null = null;
    let syncService: TelegramSyncService | null = null;

    try {
        // Получаем экземпляр Telegram клиента
        console.log('1. Подключение к Telegram...');
        client = await TelegramService.getInstance();
        console.log('   ✅ Подключение установлено');

        // Получаем канал с файлами
        console.log('2. Получение доступа к каналу с файлами...');
        const filesChannel = await client.getFilesChannel();
        console.log('   ✅ Доступ к каналу с файлами получен');

        // Получаем сообщения с пагинацией
        console.log('3. Получение исторических сообщений...');
        
        const allMessages: any[] = [];
        let offsetId: number | undefined = undefined;
        const batchSize = 50; // Размер батча
        let batchCount = 0;
        const maxBatches = 2; // Обрабатываем 2 батча для демонстрации
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Получаем доступ к Supabase
        const admin = getSupabaseAdmin();
        if (!admin) {
            console.error('❌ Не удалось получить доступ к Supabase Admin');
            return;
        }

        // Создаем экземпляр сервиса синхронизации
        syncService = await TelegramSyncService.getInstance();

        while (batchCount < maxBatches) {
            console.log(`\n   📦 Обработка батча ${batchCount + 1} (offsetId: ${offsetId || 'latest'})...`);
            
            const messages = await client.getMessages(filesChannel, batchSize, offsetId);
            
            if (!messages || messages.length === 0) {
                console.log('   ⚠️  Больше сообщений нет');
                break;
            }
            
            console.log(`   ✅ Получено ${messages.length} сообщений`);
            
            // Обрабатываем каждое сообщение в батче
            for (let i = 0; i < messages.length; i++) {
                const msg: any = messages[i];
                
                if (!msg.document) {
                    continue;
                }
                
                // Ищем имя файла
                let filename = 'unknown.fb2';
                if (msg.document.attributes) {
                    const fileNameAttr = msg.document.attributes.find((attr: any) =>
                        attr.className === 'DocumentAttributeFilename'
                    );
                    if (fileNameAttr && (fileNameAttr as any).fileName) {
                        filename = (fileNameAttr as any).fileName;
                    }
                }
                
                console.log(`\n     📄 Файл ${processedCount + skippedCount + errorCount + 1}: ${filename}`);
                
                // Ищем по словам
                const words = extractWordsFromFilename(filename);
                console.log(`     🔍 Поиск по словам: ${words.join(', ')}`);
                
                const potentialMatches = await searchBooksByWords(admin, words);
                
                if (potentialMatches.length > 0) {
                    // Выбираем лучшее совпадение (первое в отсортированном списке)
                    const bestMatch = potentialMatches[0];
                    console.log(`     🎯 Найдено совпадение:`);
                    console.log(`        "${bestMatch.title}" автора ${bestMatch.author}`);
                    console.log(`        ID: ${bestMatch.id} (релевантность: ${bestMatch.score})`);
                    
                    // Для демонстрации обрабатываем только каждый 10-й файл
                    if ((processedCount + skippedCount + errorCount) % 10 === 0) {
                        // Загружаем и привязываем файл
                        console.log(`     📤 Загрузка и привязка файла...`);
                        try {
                            await syncService.processFile(msg, bestMatch.id);
                            console.log(`     ✅ Файл успешно загружен и привязан к книге`);
                            processedCount++;
                        } catch (processError) {
                            console.log(`     ❌ Ошибка при загрузке/привязке файла: ${processError}`);
                            errorCount++;
                        }
                    } else {
                        console.log(`     ℹ️  Пропущен для демонстрации (реальная система будет обрабатывать все)`);
                        skippedCount++;
                    }
                } else {
                    console.log(`     ⚠️  Совпадений не найдено, файл пропущен`);
                    skippedCount++;
                }
            }
            
            // Устанавливаем offsetId для следующего запроса
            const oldestMessage = messages[messages.length - 1];
            offsetId = oldestMessage.id;
            
            batchCount++;
        }

        // Отключаемся
        await syncService.shutdown();
        if (client && typeof (client as any).disconnect === 'function') {
            await (client as any).disconnect();
            console.log('\n4. Отключение от Telegram...');
            console.log('   ✅ Отключение выполнено');
        }

        // Выводим статистику
        console.log('\n=== СТАТИСТИКА ОБРАБОТКИ ===');
        console.log(`   ✅ Успешно обработано: ${processedCount} файлов`);
        console.log(`   ⚠️  Пропущено: ${skippedCount} файлов`);
        console.log(`   ❌ Ошибок: ${errorCount} файлов`);
        console.log(`   📊 Всего: ${processedCount + skippedCount + errorCount} файлов`);

        console.log('\n=== ОБРАБОТКА ЗАВЕРШЕНА ===');

    } catch (error) {
        console.error('❌ Ошибка при обработке файлов:', error);

        // Отключаемся в случае ошибки
        if (syncService) {
            try {
                await syncService.shutdown();
            } catch (shutdownError) {
                console.log('   ⚠️  Ошибка при отключении сервиса синхронизации:', shutdownError);
            }
        }

        if (client && typeof (client as any).disconnect === 'function') {
            try {
                await (client as any).disconnect();
                console.log('   ✅ Отключение выполнено');
            } catch (disconnectError) {
                console.log('   ⚠️  Ошибка при отключении:', disconnectError);
            }
        }
    }
}

processHistoricalTelegramFiles().catch(console.error);