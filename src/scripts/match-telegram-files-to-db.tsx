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
    
    return uniqueMatches.slice(0, 10); // Ограничиваем 10 результатами
}

async function matchTelegramFilesToDB() {
    console.log('=== СОПОСТАВЛЕНИЕ ФАЙЛОВ TELEGRAM С КНИГАМИ В БД ===\n');
    
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
        const messages = await client.getMessages(filesChannel, 10);
        
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
        console.log('4. Анализ файлов и поиск соответствий в БД:');
        for (let i = 0; i < Math.min(messages.length, 5); i++) { // Ограничиваем 5 файлами для теста
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
            
            console.log(`\n   Файл ${i + 1}: ${filename}`);
            
            // Разбиваем имя файла на слова
            const words = extractWordsFromFilename(filename);
            console.log(`     Слова: ${words.join(', ')}`);
            
            // Ищем книги в базе данных по словам
            console.log(`     Поиск в БД по словам...`);
            
            try {
                // Сначала пробуем точный поиск по автору и названию (если возможно извлечь)
                const metadata = TelegramSyncService.extractMetadataFromFilename(filename);
                if (metadata.author !== 'Unknown') {
                    const { data: exactMatch, error: exactError } = await (admin as any)
                        .from('books')
                        .select('id, title, author')
                        .eq('title', metadata.title)
                        .eq('author', metadata.author)
                        .single();
                    
                    if (!exactError && exactMatch) {
                        console.log(`     ✅ Точное совпадение: "${exactMatch.title}" автора ${exactMatch.author}`);
                        console.log(`        ID: ${exactMatch.id}`);
                        continue;
                    }
                }
                
                // Если точного совпадения нет, ищем по словам
                const potentialMatches = await searchBooksByWords(admin, words);
                
                if (potentialMatches.length > 0) {
                    console.log(`     🔄 Найдены потенциальные совпадения (${potentialMatches.length}):`);
                    potentialMatches.slice(0, 5).forEach((book: any, index: number) => {
                        console.log(`        ${index + 1}. "${book.title}" автора ${book.author} (ID: ${book.id})`);
                    });
                } else {
                    console.log(`     ⚠️  Совпадений не найдено`);
                }
            } catch (dbError) {
                console.log(`     ❌ Ошибка поиска в БД: ${dbError}`);
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

matchTelegramFilesToDB().catch(console.error);