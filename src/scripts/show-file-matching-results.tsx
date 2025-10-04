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

// Функция для поиска точного совпадения книги
async function findExactBookMatch(admin: any, filename: string) {
    const metadata = TelegramSyncService.extractMetadataFromFilename(filename);
    if (metadata.author !== 'Unknown') {
        const { data: exactMatch, error: exactError } = await (admin as any)
            .from('books')
            .select('id, title, author')
            .eq('title', metadata.title)
            .eq('author', metadata.author)
            .single();
        
        if (!exactError && exactMatch) {
            return exactMatch;
        }
    }
    return null;
}

// Функция для поиска книг по словам из имени файла
async function searchBooksByWords(admin: any, words: string[]) {
    // Ищем книги, где в названии или авторе встречаются слова из имени файла
    const searchPromises = words.map(async (word) => {
        const { data: titleMatches, error: titleError } = await (admin as any)
            .from('books')
            .select('id, title, author')
            .ilike('title', `%${word}%`)
            .limit(3);
        
        const { data: authorMatches, error: authorError } = await (admin as any)
            .from('books')
            .select('id, title, author')
            .ilike('author', `%${word}%`)
            .limit(3);
        
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
    
    matchesWithScores.sort((a, b) => b.score - a.score);
    
    // Берем только лучшие совпадения и фильтруем по минимальной релевантности
    const topMatches = matchesWithScores.slice(0, 5);
    
    // Возвращаем только совпадения с релевантностью >= 2
    return topMatches.filter(match => match.score >= 2);
}

async function showFileMatchingResults() {
    console.log('=== РЕЗУЛЬТАТЫ СОПОСТАВЛЕНИЯ ФАЙЛОВ TELEGRAM С КНИГАМИ В БД ===\n');
    
    let client: TelegramService | null = null;
    
    try {
        // Получаем экземпляр Telegram клиента
        console.log('1. Подключение к Telegram...');
        client = await TelegramService.getInstance();
        console.log('   ✅ Подключение установлено');
        
        // Получаем канал с файлами
        console.log('2. Получение доступа к каналу с файлами...');
        const filesChannel = await client.getFilesChannel();
        console.log('   ✅ Доступ к каналу с файлами получен');
        
        // Получаем несколько сообщений с файлами
        console.log('3. Получение сообщений с файлами...');
        const messages = await client.getMessages(filesChannel, 10); // Увеличиваем до 10
        
        if (messages.length === 0) {
            console.log('   ⚠️  Нет сообщений в канале');
            return;
        }
        
        console.log(`   ✅ Получено ${messages.length} сообщений с файлами\n`);
        
        // Получаем доступ к Supabase
        const admin = getSupabaseAdmin();
        if (!admin) {
            console.error('❌ Не удалось получить доступ к Supabase Admin');
            return;
        }
        
        // Обрабатываем каждое сообщение
        console.log('4. Результаты сопоставления:');
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
                if (fileNameAttr && fileNameAttr.fileName) {
                    filename = fileNameAttr.fileName;
                }
            }
            
            console.log(`\n   📄 Файл ${i + 1}: ${filename}`);
            
            // Ищем точное совпадение книги
            console.log(`     🔍 Поиск точного совпадения...`);
            const exactMatch = await findExactBookMatch(admin, filename);
            
            if (exactMatch) {
                console.log(`     ✅ ТОЧНОЕ СОВПАДЕНИЕ:`);
                console.log(`        Название: "${exactMatch.title}"`);
                console.log(`        Автор: ${exactMatch.author}`);
                console.log(`        ID: ${exactMatch.id}`);
            } else {
                // Если точного совпадения нет, ищем по словам
                console.log(`     🔍 Поиск по словам...`);
                const words = extractWordsFromFilename(filename);
                console.log(`        Слова для поиска: ${words.join(', ')}`);
                
                const potentialMatches = await searchBooksByWords(admin, words);
                
                if (potentialMatches.length > 0) {
                    console.log(`     🔄 ПОТЕНЦИАЛЬНЫЕ СОВПАДЕНИЯ (${potentialMatches.length}):`);
                    potentialMatches.forEach((book: any, index: number) => {
                        console.log(`        ${index + 1}. "${book.title}" автора ${book.author}`);
                        console.log(`           ID: ${book.id} (релевантность: ${book.score})`);
                    });
                } else {
                    console.log(`     ⚠️  Совпадений не найдено`);
                }
            }
            
            if (i < messages.length - 1) {
                console.log('     ' + '─'.repeat(50));
            }
        }
        
        // Отключаемся
        if (client && typeof (client as any).disconnect === 'function') {
            await (client as any).disconnect();
            console.log('\n5. Отключение от Telegram...');
            console.log('   ✅ Отключение выполнено');
        }
        
        console.log('\n=== АНАЛИЗ ЗАВЕРШЕН ===');
        
    } catch (error) {
        console.error('❌ Ошибка при сопоставлении файлов:', error);
        
        // Отключаемся в случае ошибки
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

showFileMatchingResults().catch(console.error);