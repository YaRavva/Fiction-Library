import { TelegramService } from './client';
import { getSupabaseAdmin } from '../supabase';
import { serverSupabase } from '../serverSupabase';
import { putObject } from '../s3-service';
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import * as path from 'path';
import { MetadataExtractionService } from './metadata-extraction-service';

export class FileProcessingService {
    private static instance: FileProcessingService;
    private telegramClient: TelegramService | null = null;

    private constructor() {}

    public static async getInstance(): Promise<FileProcessingService> {
        if (!FileProcessingService.instance) {
            FileProcessingService.instance = new FileProcessingService();
            FileProcessingService.instance.telegramClient = await TelegramService.getInstance();
        }
        return FileProcessingService.instance;
    }

    /**
     * Скачивает и обрабатывает файлы из канала "Архив для фантастики" напрямую (без очереди)
     * @param limit Количество сообщений для обработки
     */
    public async downloadAndProcessFilesDirectly(limit: number = 10): Promise<{[key: string]: unknown}[]> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            // Получаем канал с файлами
            console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
            const channel = await this.telegramClient.getFilesChannel();
            
            // Получаем ID последнего загруженного файла из telegram_processed_messages
            // Файлы в канале отсортированы от новых к старым, поэтому мы начинаем с предыдущего файла
            console.log('🔍 Получаем ID последнего загруженного файла...');
            
            // Получаем последний обработанный файл из telegram_processed_messages
            const result: { data: any | null; error: any } = await serverSupabase
                .from('telegram_processed_messages')
                .select('telegram_file_id')
                .not('telegram_file_id', 'is', null)
                .order('processed_at', { ascending: false })
                .limit(1)
                .single();

            const { data: lastProcessed, error: lastProcessedError } = result;

            let lastFileId: number | undefined = undefined;
            if (lastProcessed && lastProcessed.telegram_file_id) {
                // Если есть последний обработанный файл, начинаем с него
                lastFileId = parseInt(lastProcessed.telegram_file_id, 10);
                console.log(`  📌 Начинаем с файла ID: ${lastFileId}`);
            } else {
                console.log('  🆕 Начинаем с самых новых файлов');
            }
            
            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                String(channel.id);
            
            // Получаем сообщения с пагинацией
            console.log(`📥 Получаем сообщения (лимит: ${limit}, lastFileId: ${lastFileId})...`);
            const messages = await Promise.race([
                this.telegramClient.getMessages(channelId, limit, lastFileId) as unknown as any[],
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting messages')), 60000))
            ]) as unknown as any[];
            console.log(`✅ Получено ${messages.length} сообщений\n`);

            const results: {[key: string]: unknown}[] = [];
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg = msg as unknown as {[key: string]: unknown};
                
                // Если у нас есть ID последнего файла, пропускаем сообщения с ID больше чем последний загруженный
                // (так как файлы отсортированы от новых к старым)
                if (lastFileId && parseInt(String(anyMsg.id), 10) > lastFileId) {
                    console.log(`⏭️  Пропускаем сообщение ${anyMsg.id} (уже обработано)`);
                    continue;
                }
                
                console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);
                
                // Проверяем, есть ли в сообщении медиа (файл)
                if (!(anyMsg.media as unknown)) {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа, пропускаем`);
                    continue;
                }
                
                try {
                    // Скачиваем и обрабатываем файл напрямую
                    const result = await this.downloadAndProcessSingleFile(anyMsg);
                    results.push(result);
                    
                } catch (msgError) {
                    console.error(`  ❌ Ошибка обработки сообщения ${anyMsg.id}:`, msgError);
                    results.push({
                        messageId: anyMsg.id,
                        success: false,
                        error: msgError instanceof Error ? msgError.message : 'Unknown error'
                    });
                }
            }
            
            console.log(`\n📊 Всего обработано файлов: ${results.length}`);
            return results;
        } catch (error) {
            console.error('Error downloading files from archive channel:', error);
            throw error;
        }
    }

    /**
     * Получает список файлов для обработки без их непосредственной обработки
     * @param limit Количество сообщений для получения
     * @param offsetId ID сообщения, с которого начинать (для пагинации)
     */
    public async getFilesToProcess(limit: number = 10, offsetId?: number): Promise<{[key: string]: unknown}[]> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            // Получаем канал с файлами
            console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
            const channel = await this.telegramClient.getFilesChannel();
            
            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                String(channel.id);
            
            const allResults: {[key: string]: unknown}[] = [];
            
            // Получаем сообщения с пагинацией
            console.log(`📥 Получаем сообщения (лимит: ${limit}, offsetId: ${offsetId})...`);
            const messages = await Promise.race([
                this.telegramClient.getMessages(channelId, limit, offsetId) as unknown as any[],
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting messages')), 60000))
            ]) as unknown as any[];
            
            console.log(`✅ Получено ${messages.length} сообщений`);
            
            // Формируем список файлов для обработки
            for (const msg of messages) {
                const anyMsg = msg as unknown as {[key: string]: unknown};
                
                // Проверяем, есть ли в сообщении медиа (файл)
                if (!(anyMsg.media as unknown)) {
                    continue;
                }
                
                // Извлекаем имя файла для отображения
                let filenameCandidate = `book_${anyMsg.id}.fb2`;
                
                // Попробуем получить имя файла из разных источников
                if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).attributes) {
                    const attributes = (anyMsg.document as {[key: string]: unknown}).attributes as unknown[];
                    const attrFileName = attributes.find((attr: unknown) => {
                        const attrObj = attr as {[key: string]: unknown};
                        return attrObj.className === 'DocumentAttributeFilename';
                    }) as {[key: string]: unknown} | undefined;
                    if (attrFileName && attrFileName.fileName) {
                        filenameCandidate = attrFileName.fileName as string;
                    }
                } else if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).fileName) {
                    filenameCandidate = (anyMsg.document as {[key: string]: unknown}).fileName as string;
                } else if (anyMsg.fileName) {
                    filenameCandidate = anyMsg.fileName as string;
                }
                
                allResults.push({
                    messageId: anyMsg.id,
                    filename: filenameCandidate,
                    hasMedia: !!(anyMsg.media as unknown)
                });
            }
            
            console.log(`\n📊 Всего файлов для обработки: ${allResults.length}`);
            return allResults;
        } catch (error) {
            console.error('Error getting files to process:', error);
            throw error;
        }
    }

    /**
     * Обрабатывает один файл по ID сообщения
     * @param messageId ID сообщения с файлом
     */
    public async processSingleFileById(messageId: number): Promise<{[key: string]: unknown}> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            // Получаем канал с файлами
            console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
            const channel = await this.telegramClient.getFilesChannel();
            
            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                String(channel.id);
            
            // Получаем конкретное сообщение
            // Используем ids вместо offsetId для получения точного сообщения
            console.log(`📥 Получаем сообщение ${messageId}...`);
            
            // Получаем сообщение по точному ID используя правильный метод
            // В Telegram API для получения конкретных сообщений по ID нужно использовать параметр ids
            const messages = await this.telegramClient.getMessages(channel, 1, messageId) as any[];
            
            // Проверяем, получили ли мы сообщения
            if (!messages || messages.length === 0) {
                throw new Error(`Message ${messageId} not found`);
            }
            
            // Получаем первое (и единственное) сообщение из результата
            const targetMessage = messages[0];
            
            // Проверяем, что сообщение не undefined или null
            if (!targetMessage) {
                throw new Error(`Message ${messageId} is undefined or null`);
            }
            
            const anyMsg = targetMessage as unknown as {[key: string]: unknown};
            
            // Проверяем, есть ли в сообщении медиа (файл)
            if (!anyMsg || anyMsg.media === undefined || anyMsg.media === null) {
                console.warn(`  ⚠️  Message ${messageId} does not contain media property`);
                // Попробуем найти медиа в других свойствах
                if (anyMsg && anyMsg.document) {
                    console.log(`  📄 Найден документ в свойстве document`);
                    anyMsg.media = anyMsg.document;
                } else if (anyMsg && anyMsg.photo) {
                    console.log(`  📸 Найдено фото в свойстве photo`);
                    anyMsg.media = anyMsg.photo;
                } else {
                    throw new Error(`Message ${messageId} does not contain media`);
                }
            }
            
            // Обрабатываем файл
            console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);
            const result = await this.downloadAndProcessSingleFile(anyMsg);
            
            return result;
        } catch (error) {
            console.error(`Error processing file ${messageId}:`, error);
            throw error;
        }
    }

    /**
     * Обрабатывает один файл напрямую с правильной логикой:
     * 1. Получается имя файла из приватного канала
     * 2. Сразу используется релевантный поиск
     * 3. Если книга найдена с высокой степенью релевантности, то файл скачивается, загружается в бакет, 
     *    заносится в telegram_file_id в таблице telegram_processed_messages и привязывается к книге
     * 4. Если книга не найдена или для книги есть запись о файле в telegram_file_id в таблице telegram_processed_messages, 
     *    то файл пропускается даже без скачивания
     * @param message Сообщение Telegram с файлом
     */
    public async processSingleFile(message: {[key: string]: unknown}): Promise<{[key: string]: unknown}> {
        return await this.downloadAndProcessSingleFile(message);
    }

    /**
      * Скачивает и обрабатывает один файл напрямую с исправленной логикой:
      * 1. Получается имя файла из приватного канала
      * 2. Сразу используется релевантный поиск по оригинальному имени файла
      * 3. Если книга найдена с высокой степенью релевантности, то файл скачивается, загружается в бакет,
      *    заносится в telegram_file_id в таблице telegram_processed_messages и привязывается к книге
      * 4. Если книга не найдена или для книги есть запись о файле в telegram_file_id в таблице telegram_processed_messages,
      *    то файл пропускается даже без скачивания
      * @param message Сообщение Telegram с файлом
      */
     private async downloadAndProcessSingleFile(message: {[key: string]: unknown}): Promise<{[key: string]: unknown}> {
        const anyMsg = message as unknown as {[key: string]: unknown};
        console.log(`📥 Обработка файла из сообщения ${anyMsg.id}...`);
        
        // Получаем ОРИГИНАЛЬНОЕ имя файла из Telegram сообщения для анализа
        let originalFilename = `book_${anyMsg.id}.fb2`;

        // Попробуем получить имя файла из разных источников
        if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).attributes) {
            const attributes = (anyMsg.document as {[key: string]: unknown}).attributes as unknown[];
            const attrFileName = attributes.find((attr: unknown) => {
                const attrObj = attr as {[key: string]: unknown};
                return attrObj.className === 'DocumentAttributeFilename';
            }) as {[key: string]: unknown} | undefined;
            if (attrFileName && attrFileName.fileName) {
                originalFilename = attrFileName.fileName as string;
            }
        } else if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).fileName) {
            // Альтернативный способ получения имени файла
            originalFilename = (anyMsg.document as {[key: string]: unknown}).fileName as string;
        } else if (anyMsg.fileName) {
            // Еще один способ получения имени файла
            originalFilename = anyMsg.fileName as string;
        }

        // Проверяем, не является ли файл служебным (эскизом)
        if (originalFilename.includes('_thumb.jpg') || originalFilename.includes('.pdf_thumb')) {
            console.log(`  ⚠️  Пропускаем служебный файл (эскиз): ${originalFilename}`);
            return {
                messageId: anyMsg.id,
                filename: originalFilename,
                success: true,
                skipped: true,
                reason: 'technical_file',
                bookTitle: null,
                bookAuthor: null,
                searchTerms: []
            };
        }
        
        try {
            // ИЗМЕНЕНИЕ: Получаем ОРИГИНАЛЬНОЕ имя файла из Telegram сообщения для анализа
            let originalFilename = `book_${anyMsg.id}.fb2`;

            // Попробуем получить имя файла из разных источников
            if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).attributes) {
                const attributes = (anyMsg.document as {[key: string]: unknown}).attributes as unknown[];
                const attrFileName = attributes.find((attr: unknown) => {
                    const attrObj = attr as {[key: string]: unknown};
                    return attrObj.className === 'DocumentAttributeFilename';
                }) as {[key: string]: unknown} | undefined;
                if (attrFileName && attrFileName.fileName) {
                    originalFilename = attrFileName.fileName as string;
                }
            } else if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).fileName) {
                // Альтернативный способ получения имени файла
                originalFilename = (anyMsg.document as {[key: string]: unknown}).fileName as string;
            } else if (anyMsg.fileName) {
                // Еще один способ получения имени файла
                originalFilename = anyMsg.fileName as string;
            }

            console.log(`  📄 Оригинальное имя файла из Telegram: "${originalFilename}"`);

            // Демонстрируем нормализацию Unicode для оригинального имени файла
            const normalizedFilename = originalFilename.normalize('NFC');

            // Извлекаем метаданные из НОРМАЛИЗОВАННОГО имени файла для поиска книги
            const { author, title } = MetadataExtractionService.extractMetadataFromFilename(normalizedFilename);

            // Разбиваем нормализованное имя файла на слова для более точного поиска
            const searchTerms = MetadataExtractionService.extractSearchTerms(normalizedFilename);
            
            // Сначала ищем книгу по релевантности без скачивания файла
            console.log(`  🔍 Поиск книги по релевантности...`);
            
            // Ищем книги по поисковым терминам
            let allMatches: unknown[] = [];
            
            // Если у нас есть поисковые термины, используем их для поиска
            if (searchTerms.length > 0) {
                // Создаем условия поиска для каждого термина
                // Поиск по названию и автору с использованием ILIKE
                const searchPromises = [];
                
                // Поиск по каждому термину в названии
                for (const term of searchTerms) {
                    searchPromises.push(
                        serverSupabase
                            .from('books')
                            .select('id, title, author')
                            .ilike('title', `%${term}%`)
                            .limit(5)
                    );
                }
                
                // Поиск по каждому термину в авторе
                for (const term of searchTerms) {
                    searchPromises.push(
                        serverSupabase
                            .from('books')
                            .select('id, title, author')
                            .ilike('author', `%${term}%`)
                            .limit(5)
                    );
                }
                
                // Выполняем все поисковые запросы параллельно
                try {
                    const results = await Promise.all(searchPromises);
                    
                    // Объединяем все результаты
                    allMatches = results.flatMap((result: any) => result.data || []);
                } catch (searchError) {
                    console.warn(`  ⚠️  Ошибка при поиске книг:`, searchError);
                }
                
                console.log(`  📚 Найдено ${allMatches.length} потенциальных совпадений по терминам`);
            }
            
            // Если книги не найдены по терминам, используем оригинальный метод
            if (allMatches.length === 0) {
                const searchPromises = [];
                
                // Поиск по названию
                searchPromises.push(
                    serverSupabase
                        .from('books')
                        .select('id, title, author')
                        .ilike('title', `%${title}%`)
                        .limit(5)
                );
                
                // Поиск по автору
                searchPromises.push(
                    serverSupabase
                        .from('books')
                        .select('id, title, author')
                        .ilike('author', `%${author}%`)
                        .limit(5)
                );
                
                // Выполняем все поисковые запросы параллельно
                try {
                    const results = await Promise.all(searchPromises);
                    
                    // Объединяем все результаты
                    allMatches = results.flatMap((result: any) => result.data || []);
                } catch (searchError) {
                    console.warn(`  ⚠️  Ошибка при поиске книг:`, searchError);
                }
            }
            
            // Удаляем дубликаты по ID
            const uniqueMatches = allMatches.filter((bookItem, index, self) => 
                index === self.findIndex(b => (b as { id: string }).id === (bookItem as { id: string }).id)
            );
            
            // Если книги не найдены, пропускаем файл
            if (uniqueMatches.length === 0) {
                console.log(`  ⚠️  Книга не найдена по релевантности. Файл пропущен: ${originalFilename}`);
                return {
                    messageId: anyMsg.id,
                    filename: originalFilename,
                    success: true,
                    skipped: true,
                    reason: 'book_not_found',
                    bookTitle: title,
                    bookAuthor: author,
                    searchTerms: searchTerms
                };
            }
            
            console.log(`  📚 Найдено ${uniqueMatches.length} уникальных совпадений`);
            
            // Выбираем наиболее релевантную книгу из найденных
            const bestMatch = MetadataExtractionService.selectBestMatch(uniqueMatches, searchTerms, title, author);
            
            // Проверяем, что нашли подходящую книгу
            if (!bestMatch) {
                console.log(`  ⚠️  Подходящая книга не найдена по релевантности. Файл пропущен: ${originalFilename}`);
                return {
                    messageId: anyMsg.id,
                    filename: originalFilename,
                    success: true,
                    skipped: true,
                    reason: 'no_matching_book',
                    bookTitle: title,
                    bookAuthor: author,
                    searchTerms: searchTerms
                };
            }
            
            console.log(`  ✅ Выбрана лучшая книга: "${(bestMatch as { title: string }).title}" автора ${(bestMatch as { author: string }).author}`);
            
            const book = bestMatch as { id: string; title: string; author: string };
            
            // Проверяем, существует ли запись в telegram_processed_messages для данной книги
            // Записи должны создаваться только при синхронизации метаданных из публичного канала
            
            const { data: existingRecords, error: selectError } = await serverSupabase
                .from('telegram_processed_messages')
                .select('*')
                .eq('book_id', book.id);
                
            if (selectError) {
                console.warn(`  ⚠️  Ошибка при проверке существования записи в telegram_processed_messages:`, selectError);
                // Продолжаем выполнение, так как это не критическая ошибка
            } else if (!existingRecords || existingRecords.length === 0) {
                // Если записи нет, значит книга не была импортирована из публичного канала
                console.log(`  ⚠️  Запись в telegram_processed_messages не найдена для book_id: ${book.id}. Книга не импортирована, файл пропущен.`);
                return {
                    messageId: anyMsg.id,
                    filename: originalFilename,
                    success: true,
                    skipped: true,
                    reason: 'book_not_imported',
                    bookTitle: book?.title,
                    bookAuthor: book?.author,
                    searchTerms: searchTerms
                };
            }
            
            // Проверяем, существует ли запись в telegram_processed_messages с telegram_file_id для этой книги
            // Если запись с telegram_file_id уже существует, значит файл уже был загружен
            try {
                // Проверяем, существует ли запись в telegram_processed_messages с telegram_file_id равным ID текущего файла
                const { data: existingFileRecords, error: selectFileError } = await serverSupabase
                    .from('telegram_processed_messages')
                    .select('*')
                    .eq('telegram_file_id', String(anyMsg.id));
                    
                if (selectFileError) {
                    console.warn(`  ⚠️  Ошибка при проверке существования файла в telegram_processed_messages:`, selectFileError);
                } else if (existingFileRecords && existingFileRecords.length > 0) {
                    // Если запись с таким telegram_file_id уже существует, файл уже был загружен
                    console.log(`  ⚠️  Файл уже был загружен ранее, пропускаем: ${originalFilename}`);
                    return {
                        messageId: anyMsg.id,
                        filename: originalFilename,
                        success: true,
                        skipped: true,
                        reason: 'already_processed',
                        bookTitle: book?.title,
                        bookAuthor: book?.author,
                        searchTerms: searchTerms
                    };
                }
                
                // Проверяем, существует ли запись в telegram_processed_messages для книги с уже установленным telegram_file_id
                const bookId = existingRecords ? (existingRecords[0] as { book_id: string }).book_id : null;
                if (!bookId) {
                    console.warn(`  ⚠️  Не удалось получить book_id из существующих записей`);
                    return {
                        messageId: anyMsg.id,
                        filename: originalFilename,
                        success: true,
                        skipped: true,
                        reason: 'book_not_imported',
                        bookTitle: book?.title,
                        bookAuthor: book?.author,
                        searchTerms: searchTerms
                    };
                }
                
                const { data: existingBookRecords, error: selectBookError } = await serverSupabase
                    .from('telegram_processed_messages')
                    .select('*')
                    .eq('book_id', bookId);
                    
                // Фильтруем записи с не пустым telegram_file_id
                const filteredRecords = existingBookRecords ? existingBookRecords.filter((record: any) => 
                    record.telegram_file_id && record.telegram_file_id !== null
                ) : [];
                
                if (selectBookError) {
                    console.warn(`  ⚠️  Ошибка при проверке существования записи книги в telegram_processed_messages:`, selectBookError);
                } else if (filteredRecords && filteredRecords.length > 0) {
                    // Если для этой книги уже есть запись с telegram_file_id, файл уже был загружен
                    console.log(`  ⚠️  Для книги уже загружен файл, пропускаем: ${originalFilename}`);
                    return {
                        messageId: anyMsg.id,
                        filename: originalFilename,
                        success: true,
                        skipped: true,
                        reason: 'book_already_has_file', // Книга уже имеет загруженный файл
                        bookTitle: book?.title,
                        bookAuthor: book?.author,
                        searchTerms: searchTerms
                    };
                }
            } catch (checkError) {
                console.warn(`  ⚠️  Ошибка при проверке существующих записей:`, checkError);
            }
            
            // Проверяем, существует ли запись в таблице books с таким же telegram_file_id
            // Если запись существует, значит файл уже был привязан к какой-то книге
            try {
                // Используем book_id из найденной книги
                const bookId = book.id;
                
                // Проверяем, есть ли в таблице books запись с этим book_id и заполненным telegram_file_id
                const { data: bookFileRecords, error: bookFileError } = await serverSupabase
                    .from('books')
                    .select('*')
                    .eq('id', book.id);
                    
                if (bookFileError) {
                    console.warn(`  ⚠️  Ошибка при проверке существования записи в books:`, bookFileError);
                } else if (bookFileRecords && bookFileRecords.length > 0) {
                    // Проверяем, заполнено ли поле telegram_file_id
                    const bookRecord = bookFileRecords[0] as { telegram_file_id: string | null };
                    if (bookRecord.telegram_file_id && bookRecord.telegram_file_id !== null) {
                        // Если для этой книги в таблице books уже заполнено telegram_file_id, файл уже был привязан
                        console.log(`  ⚠️  Для книги уже привязан файл в таблице books, пропускаем: ${originalFilename}`);
                        return {
                            messageId: anyMsg.id,
                            filename: originalFilename,
                            success: true,
                            skipped: true,
                            reason: 'book_already_has_file_in_books_table', // Книга уже имеет файл в таблице books
                            bookTitle: book?.title,
                            bookAuthor: book?.author,
                            searchTerms: searchTerms
                        };
                    }
                }
            } catch (checkBookError) {
                console.warn(`  ⚠️  Ошибкашибка при проверке существующих записей в books:`, checkBookError);
            }
            
            // Определяем имя файла, mime и автора с учётом разных структур message
            let ext = '.fb2';
            let mime = 'application/octet-stream';
            let fileFormat = 'fb2';

            if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).attributes) {
                const attributes = (anyMsg.document as {[key: string]: unknown}).attributes as unknown[];
                const attrFileName = attributes.find((attr: unknown) => {
                    const attrObj = attr as {[key: string]: unknown};
                    return attrObj.className === 'DocumentAttributeFilename';
                }) as {[key: string]: unknown} | undefined;
                if (attrFileName && attrFileName.fileName) {
                    originalFilename = attrFileName.fileName as string;
                    ext = path.extname(originalFilename) || '.fb2';
                }
            }

            // Определяем MIME-тип и формат файла по расширению
            const mimeTypes: Record<string, string> = {
                '.fb2': 'application/fb2+xml',
                '.zip': 'application/zip',
            };
            
            // Определяем допустимые форматы файлов для базы данных (только fb2 и zip)
            const allowedFormats: Record<string, string> = {
                '.fb2': 'fb2',
                '.zip': 'zip',
            };
            
            mime = mimeTypes[ext.normalize('NFC').toLowerCase()] || 'application/octet-stream';
            fileFormat = allowedFormats[ext.normalize('NFC').toLowerCase()] || 'fb2';

            // Санитизируем имя файла для использования в Storage (удаляем недопустимые символы)
            const sanitizeFilename = (str: string) => {
                return str
                    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Заменяем недопустимые символы на подчеркивание
                    .replace(/^\.+/, '') // Удаляем точки в начале
                    .replace(/\.+$/, '') // Удаляем точки в конце
                    .substring(0, 255); // Ограничиваем длину имени файла
            };
            
            // Формируем имя файла для хранения в формате: MessageID.zip (как раньше)
            const storageKey = sanitizeFilename(`${anyMsg.id}${ext}`);
            const displayName = originalFilename; // Оригинальное имя файла для отображения

            // Сначала проверяем, существует ли файл в S3 бакете с таким же именем
            console.log(`  🔍 Проверяем существование файла в S3 бакете: ${storageKey}`);
            const existingFile = await this.checkExistingFileInS3(storageKey, 0, mime); // Размер неизвестен пока
            
            if (existingFile) {
                console.log(`  ✅ Файл уже существует в S3 бакете`);
                // Формируем URL файла
                const bucketName = process.env.S3_BUCKET_NAME;
                if (!bucketName) {
                    throw new Error('S3_BUCKET_NAME environment variable is not set.');
                }
                const fileUrl = `https://${bucketName}.s3.cloud.ru/${storageKey}`;
                
                // Обновляем запись книги с информацией о файле
                try {
                    const updateData: any = {
                        file_url: fileUrl,
                        file_size: existingFile.size,
                        file_format: fileFormat, // Используем допустимый формат для базы данных
                        telegram_file_id: String(anyMsg.id),
                        updated_at: new Date().toISOString()
                    };
                    
                    // Приведение типа для обхода ошибки типов Supabase
                    const booksTable: any = serverSupabase.from('books');
                    const { error: updateBookError } = await booksTable
                        .update(updateData)
                        .eq('id', book.id)
                        .select();
                        
                    // Получаем обновленную книгу отдельно
                    const { data: updatedBook, error: selectBookError } = await serverSupabase
                        .from('books')
                        .select('*')
                        .eq('id', book.id)
                        .single();
                        
                    if (updateBookError) {
                        throw updateBookError;
                    }
                    
                    if (selectBookError) {
                        throw selectBookError;
                    }
                    
                    console.log(`  ✅ Книга обновлена с информацией о файле: "${(updatedBook as { title: string }).title}"`);
                } catch (updateBookError) {
                    console.warn(`  ⚠️  Ошибка при обновлении книги:`, updateBookError);
                    throw updateBookError;
                }
                
                // Обновляем запись в telegram_processed_messages с telegram_file_id
                try {
                    if (existingRecords && existingRecords.length > 0) {
                        const updateMessageData: any = {
                            telegram_file_id: String(anyMsg.id),
                            processed_at: new Date().toISOString()
                        };
                        
                        // Приведение типа для обхода ошибки типов Supabase
                        const messagesTable: any = serverSupabase.from('telegram_processed_messages');
                        const { error: updateError } = await messagesTable
                            .update(updateMessageData)
                            .eq('id', (existingRecords[0] as { id: string }).id)
                            .select();
                    
                        if (updateError) {
                            console.warn(`  ⚠️  Ошибка при обновении telegram_processed_messages:`, updateError);
                        } else {
                            console.log(`  ✅ Запись в telegram_processed_messages обновлена с telegram_file_id: ${anyMsg.id}`);
                        }
                    }
                } catch (updateMessageError) {
                    console.warn(`  ⚠️  Ошибка при обновлении telegram_processed_messages:`, updateMessageError);
                }

                console.log(`  ✅ Существующий файл успешно привязан к книге: ${originalFilename}`);
                
                return {
                    messageId: anyMsg.id,
                    filename: originalFilename,
                    fileSize: existingFile.size,
                    fileUrl,
                    success: true,
                    bookId: book.id,
                    bookTitle: book.title,
                    bookAuthor: book.author,
                    searchTerms: searchTerms
                };
            } else {
                // Файл не существует в бакете, скачиваем его из Telegram
                console.log(`  ⬇️  Скачиваем файл из сообщения ${anyMsg.id}...`);
                
                // Скачиваем файл с увеличенным таймаутом
                const buffer = await Promise.race([
                    this.telegramClient!.downloadMedia(message),
                    new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout: Media download took too long')), 180000)) // Увеличил до 180 секунд (3 минуты)
                ]);

                if (!buffer) {
                    throw new Error('Failed to download file');
                }
                
                // После скачивания файла сразу загружаем его в S3 бакет
                // Убрана повторная проверка существования файла в S3 как избыточная
                console.log(`  ⬆️  Загружаем новый файл в S3 бакет: ${storageKey}`);
                
                // Загружаем в S3 бакет (используем S3_BUCKET_NAME из переменных окружения)
                console.log(`  ☁️  Загружаем файл в S3 бакет: ${storageKey}`);
                const bucketName = process.env.S3_BUCKET_NAME;
                if (!bucketName) {
                  throw new Error('S3_BUCKET_NAME environment variable is not set.');
                }
                await putObject(storageKey, Buffer.from(buffer), bucketName);

                // Формируем URL файла
                const fileUrl = `https://${bucketName}.s3.cloud.ru/${storageKey}`;

                    // Обновляем запись книги с информацией о файле
                    try {
                        const updateData: any = {
                            file_url: fileUrl,
                            file_size: buffer.length,
                            file_format: fileFormat, // Используем допустимый формат для базы данных
                            telegram_file_id: String(anyMsg.id),
                            updated_at: new Date().toISOString()
                        };
                        
                        // Приведение типа для обхода ошибки типов Supabase
                        const booksTable: any = serverSupabase.from('books');
                        const { error: updateBookError } = await booksTable
                            .update(updateData)
                            .eq('id', book.id)
                            .select();
                            
                        // Получаем обновленную книгу отдельно
                        const { data: updatedBook, error: selectBookError } = await serverSupabase
                            .from('books')
                            .select('*')
                            .eq('id', book.id)
                            .single();
                            
                        if (updateBookError) {
                            throw updateBookError;
                        }
                        
                        if (selectBookError) {
                            throw selectBookError;
                        }
                        
                        console.log(`  ✅ Книга обновлена с информацией о файле: "${(updatedBook as { title: string }).title}"`);
                    } catch (updateBookError) {
                        console.warn(`  ⚠️  Ошибка при обновлении книги:`, updateBookError);
                        // Удаляем загруженный файл из Storage в случае ошибки
                        console.log(`  🗑️  Удаление файла из Storage из-за ошибки обновления книги: ${storageKey}`);
                        try {
                            const admin = getSupabaseAdmin();
                            if (admin) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const storageSupabase: any = admin;
                                await storageSupabase.storage.from('books').remove([storageKey]);
                            }
                        } catch (deleteError) {
                            console.warn(`  ⚠️  Ошибка при удалении файла:`, deleteError);
                        }
                        throw updateBookError;
                    }
                    
                    // Обновляем запись в telegram_processed_messages с telegram_file_id
                    try {
                        if (existingRecords && existingRecords.length > 0) {
                            const updateMessageData: any = {
                                telegram_file_id: String(anyMsg.id),
                                processed_at: new Date().toISOString()
                            };
                            
                            // Приведение типа для обхода ошибки типов Supabase
                            const messagesTable: any = serverSupabase.from('telegram_processed_messages');
                            const { error: updateError } = await messagesTable
                                .update(updateMessageData)
                                .eq('id', (existingRecords[0] as { id: string }).id)
                                .select();
                        
                            if (updateError) {
                                console.warn(`  ⚠️  Ошибка при обновении telegram_processed_messages:`, updateError);
                            } else {
                                console.log(`  ✅ Запись в telegram_processed_messages обновлена с telegram_file_id: ${anyMsg.id}`);
                            }
                        }
                    } catch (updateMessageError) {
                        console.warn(`  ⚠️  Ошибка при обновлении telegram_processed_messages:`, updateMessageError);
                    }

                    console.log(`  ✅ Файл успешно обработан и привязан к книге: ${originalFilename}`);

                    return {
                        messageId: anyMsg.id,
                        filename: originalFilename,
                        fileSize: buffer.length,
                        fileUrl,
                        success: true,
                        bookId: book.id,
                        bookTitle: book.title,
                        bookAuthor: book.author,
                        searchTerms: searchTerms
                    };
                }
            
        } catch (error) {
            console.error(`  ❌ Ошибка при обработке файла из сообщения ${anyMsg.id}:`, error);
            throw error;
        }
    }

    /**
     * Проверяет существование файла в S3 бакете и его соответствие по размеру и типу
     * @param key Ключ файла в бакете
     * @param expectedSize Ожидаемый размер файла (0 для первой проверки)
     * @param expectedMimeType Ожидаемый MIME-тип файла
     * @returns Объект с информацией о файле или null, если файл не найден или не соответствует
     */
    private async checkExistingFileInS3(key: string, expectedSize: number, expectedMimeType: string): Promise<{ size: number; mimeType: string } | null> {
        try {
            const s3Client = new S3Client({
                endpoint: "https://s3.cloud.ru",
                region: process.env.AWS_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
                }
            });

            const command = new HeadObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: key
            });

            const response = await s3Client.send(command);
            
            // Если expectedSize равен 0, это первая проверка - просто возвращаем информацию о файле
            if (expectedSize === 0) {
                return {
                    size: response.ContentLength || 0,
                    mimeType: response.ContentType || ''
                };
            }
            
            // Проверяем соответствие размера и типа
            if (response.ContentLength === expectedSize && response.ContentType === expectedMimeType) {
                return {
                    size: response.ContentLength,
                    mimeType: response.ContentType || ''
                };
            }
            
            return null;
        } catch (error) {
            // Файл не найден или произошла ошибка
            return null;
        }
    }

    public async shutdown(): Promise<void> {
        if (this.telegramClient && typeof (this.telegramClient as unknown as {[key: string]: unknown}).disconnect === 'function') {
            try {
                // Добавляем таймаут для принудительного завершения
                await Promise.race([
                    ((this.telegramClient as unknown as {[key: string]: unknown}).disconnect as () => Promise<void>)(),
                    new Promise(resolve => setTimeout(resolve, 3000)) // 3 секунды таймаут
                ]);
            } catch (err) {
                console.warn('Error during shutdown:', err);
            }
        }
    }
}
