import { TelegramMetadataService } from './metadata-service';
import { TelegramFileService } from './file-service';
import { serverSupabase } from '../serverSupabase';
import { TelegramService } from './client';
import { uploadFileToStorage } from '../supabase';
import { MetadataParser, BookMetadata } from './parser';
import { Book } from '../supabase';

export class SyncService {
    private metadataService: TelegramMetadataService;
    private fileService: TelegramFileService;
    private telegramClient: TelegramService;

    constructor(metadataService: TelegramMetadataService, fileService: TelegramFileService, telegramClient: TelegramService) {
        this.metadataService = metadataService;
        this.fileService = fileService;
        this.telegramClient = telegramClient;
    }

    public async fullMetadataSync(): Promise<{
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    }> {
        console.log('  📚 Полная синхронизация метаданных...');
        
        try {
            const allMessages = await this.getAllMessagesFromChannel();
            
            const batchSize = 50;
            let totalProcessed = 0;
            let totalAdded = 0;
            let totalUpdated = 0;
            let totalSkipped = 0;
            let totalErrors = 0;
            
            for (let i = 0; i < allMessages.length; i += batchSize) {
                const batch = allMessages.slice(i, i + batchSize);
                console.log(`  📦 Обработка пакета ${Math.floor(i / batchSize) + 1} из ${Math.ceil(allMessages.length / batchSize)}...`);
                
                const result = await this.processMessageBatch(batch);
                
                totalProcessed += result.processed;
                totalAdded += result.added;
                totalUpdated += result.updated;
                totalSkipped += result.skipped;
                totalErrors += result.errors;
                
                console.log(`    → Обработано: ${result.processed}, Добавлено: ${result.added}, Обновлено: ${result.updated}, Пропущено: ${result.skipped}, Ошибок: ${result.errors}`);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log(`  ✅ Полная синхронизация завершена. Всего обработано: ${totalProcessed}`);
            
            return {
                processed: totalProcessed,
                added: totalAdded,
                updated: totalUpdated,
                skipped: totalSkipped,
                errors: totalErrors
            };
        } catch (error) {
            console.error('  ❌ Ошибка при полной синхронизации метаданных:', error);
            return {
                processed: 0,
                added: 0,
                updated: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    private async processMessageBatch(messages: unknown[]): Promise<{
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    }> {
        let processed = 0;
        const added = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        const details: unknown[] = [];
        const metadataList: BookMetadata[] = [];

        try {
            const { MetadataParser } = await import('../telegram/parser');
            
            for (const msg of messages) {
                processed++;
                const anyMsg = msg as unknown as { [key: string]: unknown };
                console.log(`    📝 Обрабатываем сообщение ${anyMsg.id}...`);
 
                if (!(msg as { text?: string }).text) {
                    console.log(`      ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`);
                    skipped++;
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'no text content'
                    });
                    continue;
                }
 
                const metadata = MetadataParser.parseMessage((msg as { text: string }).text);
                metadata.messageId = anyMsg.id as number;
 
                if (!metadata.title || !metadata.author || metadata.title.trim() === '' || metadata.author.trim() === '') {
                    console.log(`      ⚠️  Пропускаем сообщение ${anyMsg.id} (отсутствует название или автор)`);
                    skipped++;
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'missing title or author',
                        bookTitle: metadata.title || 'unknown',
                        bookAuthor: metadata.author || 'unknown'
                    });
                    continue;
                }
 
                let existingBook: Book | null = null;
                try {
                    const { data, error } = await serverSupabase
                        .from('books')
                        .select('id, telegram_post_id')
                        .eq('title', metadata.title)
                        .eq('author', metadata.author)
                        .limit(1)
                        .single();

                    if (!error && data) {
                        existingBook = data as Book;
                        console.log(`      ℹ️ Книга "${metadata.title}" автора ${metadata.author} найдена в БД.`);
                    }
                } catch (checkError) {
                    console.warn(`      ⚠️ Ошибка при проверке существования книги:`, checkError);
                }

                if (existingBook) {
                    if (existingBook.telegram_post_id === null || existingBook.telegram_post_id !== (anyMsg.id as number)) {
                        console.log(`      🔄 Обновляем telegram_post_id для книги "${metadata.title}" (${existingBook.id})`);
                        
                        const { error: updateError } = await (serverSupabase as any)
                            .from('books')
                            .update({ telegram_post_id: anyMsg.id as number })
                            .eq('id', (existingBook as Book).id);

                        if (updateError) {
                            console.error(`      ❌ Ошибка при обновлении telegram_post_id:`, updateError);
                            errors++;
                            details.push({ 
                                msgId: anyMsg.id, 
                                status: 'error', 
                                reason: 'failed to update telegram_post_id',
                                bookId: (existingBook as Book).id,
                                bookTitle: metadata.title,
                                bookAuthor: metadata.author
                            });
                            continue;
                        }
                        updated++;
                        details.push({ 
                            msgId: anyMsg.id, 
                            status: 'updated', 
                            reason: 'telegram_post_id updated',
                            bookId: (existingBook as Book).id,
                            bookTitle: metadata.title,
                            bookAuthor: metadata.author
                        });
                    } else {
                        console.log(`      ✅ Книга "${metadata.title}" уже имеет корректный telegram_post_id, пропускаем`);
                        skipped++;
                        details.push({ 
                            msgId: anyMsg.id, 
                            status: 'skipped', 
                            reason: 'book already has correct telegram_post_id',
                            bookId: (existingBook as Book).id,
                            bookTitle: metadata.title,
                            bookAuthor: metadata.author
                        });
                    }
                    continue;
                }
 
                const coverUrls: string[] = [];
 
                if (!existingBook && anyMsg.media) {
                    console.log(`      📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`);
                    
                    const downloadWithRetry = async (media: unknown, maxRetries = 3) => {
                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            try {
                                console.log(`        → Попытка загрузки ${attempt}/${maxRetries}...`);
                                const result = await Promise.race([
                                    this.telegramClient!.downloadMedia(media),
                                    new Promise<never>((_, reject) => 
                                        setTimeout(() => reject(new Error(`Timeout: Downloading media took too long (attempt ${attempt}/${maxRetries})`)), 60000))
                                ]);
                                return result;
                            } catch (err: unknown) {
                                console.warn(`        ⚠️ Попытка ${attempt} не удалась:`, err instanceof Error ? err.message : 'Unknown error');
                                if (attempt === maxRetries) {
                                    throw err;
                                }
                                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                            }
                        }
                    };
                    
                    if ((anyMsg.media as { className: string }).className === 'MessageMediaWebPage' && (anyMsg.media as { webpage?: { photo?: unknown } }).webpage?.photo) {
                        console.log(`        → Веб-превью с фото`);
                        try {
                            console.log(`        → Скачиваем фото из веб-превью...`);
                            const result = await downloadWithRetry((anyMsg.media as { webpage: { photo: unknown } }).webpage.photo);
                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`        → Загружаем в Storage: covers/${photoKey}`);
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`        ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`        ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err: unknown) {
                            console.error(`        ❌ Ошибка загрузки обложки из веб-превью:`, err instanceof Error ? err.message : 'Unknown error');
                        }
                    }
                    else if ((anyMsg.media as { photo?: unknown }).photo) {
                        console.log(`        → Одиночное фото`);
                        try {
                            console.log(`        → Скачиваем фото...`);
                            const result = await downloadWithRetry(msg);
 
                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`        → Загружаем в Storage: covers/${photoKey}`);
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`        ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`        ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err: unknown) {
                            console.error(`        ❌ Ошибка загрузки обложки:`, err instanceof Error ? err.message : 'Unknown error');
                        }
                    }
                    else if ((anyMsg.media as { document?: unknown }).document) {
                        const mimeType = (anyMsg.media as { document: { mimeType?: string } }).document.mimeType;
                        if (mimeType && mimeType.startsWith('image/')) {
                            console.log(`        → Одиночное изображение (документ: ${mimeType})`);
                            try {
                                console.log(`        → Скачиваем изображение...`);
                                const result = await downloadWithRetry(msg);
 
                                const photoBuffer = result instanceof Buffer ? result : null;
                                if (photoBuffer) {
                                    const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                    console.log(`        → Загружаем в Storage: covers/${photoKey}`);
                                    await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                    const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                    coverUrls.push(photoUrl);
                                    console.log(`        ✅ Обложка загружена: ${photoUrl}`);
                                } else {
                                    console.warn(`        ⚠️ Не удалось скачать изображение (пустой буфер)`);
                                }
                            } catch (err: unknown) {
                                console.error(`        ❌ Ошибка загрузки обложки:`, err instanceof Error ? err.message : 'Unknown error');
                            }
                        }
                    }
                }
 
                if (!existingBook || ((existingBook as Book).telegram_post_id === null || (existingBook as Book).telegram_post_id !== (anyMsg.id as number))) {
                    metadataList.push({
                        ...metadata,
                        coverUrls: coverUrls.length > 0 ? coverUrls : metadata.coverUrls || []
                    });
                } else {
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'book already exists with correct telegram_post_id',
                        bookId: (existingBook as Book).id,
                        bookTitle: metadata.title,
                        bookAuthor: metadata.author
                    });
                    skipped++;
                }
            }
 
            console.log(`    📊 Всего подготовлено метаданных: ${metadataList.length}`);
            
            console.log('    💾 Импортируем метаданные с дедупликацией...');
            const resultImport = await this.metadataService.importMetadataWithDeduplication(metadataList);
            
            const combinedDetails = [...details, ...resultImport.details];
            console.log('    ✅ Импорт метаданных завершен');
            
            const totalSkippedFinal = skipped + resultImport.skipped;
            
            return {
                processed: processed,
                added: resultImport.added,
                updated: resultImport.updated,
                skipped: totalSkippedFinal,
                errors: errors + resultImport.errors
            };
        } catch (error) {
            console.error('    ❌ Ошибка при обработке пакета сообщений:', error);
            errors++;
            return {
                processed: processed,
                added: 0,
                updated: 0,
                skipped: skipped,
                errors: errors
            };
        }
    }

    private async getAllMessagesFromChannel(): Promise<unknown[]> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }
        
        try {
            console.log('  📚 Получение всех сообщений из канала с метаданными...');
            
            const channel = await this.telegramClient.getMetadataChannel();
            
            const channelId = typeof channel.id === 'object' && channel !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                String(channel.id);
            
            const allMessages = await this.telegramClient.getAllMessages(channelId, 100);
            
            console.log(`  ✅ Всего получено сообщений: ${allMessages.length}`);
            return allMessages;
        } catch (error) {
            console.error('  ❌ Ошибка при получении всех сообщений:', error);
            throw error;
        }
    }

    public async syncFiles(): Promise<{
        processed: number;
        linked: number;
        skipped: number;
        errors: number;
    }> {
        try {
            if (!this.fileService) {
                throw new Error('File service not initialized');
            }
            
            const { data: booksWithoutFiles, error } = await serverSupabase
                .from('books')
                .select('id, title, author, telegram_post_id')
                .not('telegram_post_id', 'is', null)
                .is('telegram_file_id', null)
                .is('file_url', null);
            
            if (error) {
                console.error('  ❌ Ошибка при получении книг без файлов:', error);
                return {
                    processed: 0,
                    linked: 0,
                    skipped: 0,
                    errors: 1
                };
            }
            
            const validBooks = booksWithoutFiles?.filter(book => 
                (book as { title: string }).title && (book as { title: string }).title.trim() !== '' && 
                (book as { author: string }).author && (book as { author: string }).author.trim() !== ''
            ) || [];
            
            if (validBooks.length === 0) {
                console.log('  ✅ Все книги имеют файлы или недостаточно данных для поиска');
                return {
                    processed: 0,
                    linked: 0,
                    skipped: 0,
                    errors: 0
                };
            }
            
            console.log(`  📚 Найдено ${validBooks.length} книг без файлов (с непустыми названиями и авторами)`);
            
            const filesToProcess = await this.fileService.getFilesToProcess(1000);
            console.log(`  ✅ Получено ${filesToProcess.length} файлов для анализа`);
            
            let processed = 0;
            let linked = 0;
            let skipped = 0;
            let errors = 0;
            
            for (const book of validBooks) {
                const typedBook = book as Book;
                console.log(`\n  📖 Обработка книги: "${typedBook.title}" автора ${typedBook.author}`);
                
                try {
                    const matchingFile = this.findMatchingFile(typedBook, filesToProcess);
                    
                    if (matchingFile) {
                        console.log(`    📨 Найден соответствующий файл: ${matchingFile.filename}`);
                        console.log(`    📨 Message ID файла: ${matchingFile.messageId}`);
                        
                        const result = await this.fileService!.processSingleFileById(parseInt(matchingFile.messageId as string, 10));
                        
                        processed++;
                        
                        if (result.success && !result.skipped) {
                            console.log(`    ✅ Файл успешно привязан`);
                            linked++;
                        } else if (result.skipped) {
                            console.log(`    ⚠️  Файл пропущен: ${result.reason || 'Неизвестная причина'}`);
                            skipped++;
                        } else {
                            console.log(`    ⚠️  Файл не привязан: ${result.reason || 'Неизвестная причина'}`);
                            skipped++;
                        }
                    } else {
                        console.log(`    ⚠️  Соответствующий файл не найден`);
                        skipped++;
                    }
                } catch (error) {
                    console.error(`    ❌ Ошибка при обработке книги:`, error);
                    errors++;
                }
            }
            
            return {
                processed,
                linked,
                skipped,
                errors
            };
        } catch (error) {
            console.error('  ❌ Ошибка при синхронизации файлов:', error);
            return {
                processed: 0,
                linked: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    private findMatchingFile(book: Book, files: any[]): any | null {
        if (!book.title || !book.author || book.title.trim() === '' || book.author.trim() === '') {
            console.log(`    ️  Книга не имеет названия или автора, пропускаем`);
            return null;
        }
        
        console.log(`    🔍 Поиск файла для книги: "${book.title}" автора ${book.author}`);
        
        let bestMatch: any | null = null;
        let bestScore = 0;
        
        for (const file of files) {
            if (!file.filename) continue;
            
            const filename = file.filename.normalize('NFC').toLowerCase();
            const bookTitle = book.title.normalize('NFC').toLowerCase();
            const bookAuthor = book.author.normalize('NFC').toLowerCase();
            
            let score = 0;
            
            if (filename.includes(bookTitle.replace(/\s+/g, '_'))) {
                score += 20;
            }
            
            if (filename.includes(bookAuthor.replace(/\s+/g, '_'))) {
                score += 20;
            }
            
            const titleInFilename = filename.includes(bookTitle.replace(/\s+/g, '_'));
            const authorInFilename = filename.includes(bookAuthor.replace(/\s+/g, '_'));
            
            if (titleInFilename && authorInFilename) {
                score += 30;
            }
            
            const bookTitleWords = bookTitle.split(/\s+/).filter(word => word.length > 2);
            let titleWordsMatchCount = 0;
            
            for (const word of bookTitleWords) {
                if (filename.includes(word)) {
                    titleWordsMatchCount++;
                }
            }
            
            if (bookTitleWords.length > 0 && titleWordsMatchCount / bookTitleWords.length >= 0.5) {
                score += 15;
            }
            
            const falsePositiveKeywords = [
                'исчезнувш', 'умирающ', 'смерть', 'оксфордск', 'консул', 'галактическ', 
                'логосов', 'напряжен', 'двуеди', 'морск', 'славянск'
            ];
            
            const bookTitleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
                bookTitle.includes(keyword) && !filename.includes(keyword)
            );
            
            const filenameContainsFalsePositive = falsePositiveKeywords.some(keyword => 
                filename.includes(keyword) && !bookTitle.includes(keyword)
            );
            
            if (bookTitleContainsFalsePositive || filenameContainsFalsePositive) {
                score -= 20;
            }
            
            const titleMatchThreshold = Math.floor(bookTitle.length * 0.8);
            if (titleMatchThreshold > 0) {
                const partialTitle = bookTitle.substring(0, Math.min(titleMatchThreshold, bookTitle.length));
                if (filename.includes(partialTitle.replace(/\s+/g, '_'))) {
                    score += 10;
                }
            }
            
            const authorMatchThreshold = Math.floor(bookAuthor.length * 0.8);
            if (authorMatchThreshold > 0) {
                const partialAuthor = bookAuthor.substring(0, Math.min(authorMatchThreshold, bookAuthor.length));
                if (filename.includes(partialAuthor.replace(/\s+/g, '_'))) {
                    score += 10;
                }
            }
            
            const searchTerms = [...bookTitleWords, ...bookAuthor.split(/\s+/).filter(word => word.length > 2)];
            for (const term of searchTerms) {
                if (filename.includes(term)) {
                    score += 5;
                }
            }
            
            const filenameWords = filename.toLowerCase().split(/[_\-\s]+/).filter((word: string) => word.length > 2);
            let allWordsInTitle = true;
            let allWordsInAuthor = true;
            let wordsFoundCount = 0;
            let titleWordsFound = 0;
            let authorWordsFound = 0;
            
            for (const word of filenameWords) {
                if (bookTitle.includes(word)) {
                    wordsFoundCount++;
                    titleWordsFound++;
                } else {
                    allWordsInTitle = false;
                }
                if (bookAuthor.includes(word)) {
                    wordsFoundCount++;
                    authorWordsFound++;
                } else {
                    allWordsInAuthor = false;
                }
            }
            
            if (allWordsInTitle || allWordsInAuthor || wordsFoundCount > 0) {
                const wordBonus = Math.min(30, wordsFoundCount * 5);
                score += wordBonus;
                
                if (titleWordsFound > 0 && authorWordsFound > 0) {
                    score += 10;
                }
            }
            
            if (allWordsInTitle && allWordsInAuthor) {
                score += 20;
            }
            
            if (score > bestScore && score >= 30) {
                bestScore = score;
                bestMatch = file;
            }
        }
        
        if (bestMatch && bestScore >= 30) {
            console.log(`    ✅ Найдено совпадение с рейтингом ${bestScore}: ${bestMatch.filename}`);
            return bestMatch;
        }
        
        console.log(`    ⚠️  Совпадения не найдены или совпадение недостаточно точное`);
        return null;
    }

    /**
     * Корректно завершает работу сервисов
     */
    private async shutdown(): Promise<void> {
        console.log('\n🔌 Завершение работы сервисов...');
        
        try {
            if (this.fileService) {
                await this.fileService.shutdown();
            }
        } catch (error) {
            console.error('  ⚠️  Ошибка при завершении file service:', error);
        }
        
        console.log('  ✅ Книжный Червь завершил работу');
    }
    
    /**
     * Извлекает все файлы из канала "Архив для фантастики" по 100 за раз
     */
    private async extractAllFilesFromArchive(): Promise<void> {
        console.log('📦 Извлечение всех файлов из канала "Архив для фантастики"...');
        
        try {
            if (!this.fileService) {
                throw new Error('File service not initialized');
            }
            
            const batchSize = 100;
            let totalProcessed = 0;
            let hasMoreFiles = true;
            let offsetId: number | undefined = undefined;
            let batchNumber = 1;
            
            while (hasMoreFiles) {
                console.log(`📥 Обработка батча ${batchNumber} (по ${batchSize} файлов)...`);
                
                try {
                    const files = await this.fileService.getFilesToProcess(batchSize, offsetId);
                    
                    if (files.length === 0) {
                        console.log('  ✅ Все файлы извлечены');
                        hasMoreFiles = false;
                        break;
                    }
                    
                    console.log(`  📊 Получено ${files.length} файлов в батче ${batchNumber}`);
                    totalProcessed += files.length;
                    
                    const fileIds = files
                        .map(file => parseInt(String((file as { messageId: string }).messageId), 10))
                        .filter(id => !isNaN(id));
                    
                    if (fileIds.length > 0) {
                        offsetId = Math.min(...fileIds) - 1;
                    } else {
                        hasMoreFiles = false;
                        break;
                    }
                    
                    console.log(`  📈 Всего обработано: ${totalProcessed} файлов`);
                    batchNumber++;
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (batchError) {
                    console.error(`  ❌ Ошибка при обработке батча ${batchNumber}:`, batchError);
                    batchNumber++;
                }
            }
            
            console.log(`\n🎉 Извлечение файлов завершено. Всего обработано: ${totalProcessed} файлов`);
        } catch (error) {
            console.error('❌ Ошибка при извлечении файлов из архива:', error);
        }
    }
}