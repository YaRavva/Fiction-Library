import { TelegramService } from './client';
import { MetadataParser, BookMetadata } from './parser';
import { uploadFileToStorage, upsertBookRecord, getSupabaseAdmin } from '../supabase';
import { serverSupabase } from '../serverSupabase';
import { Message } from 'node-telegram-bot-api';
import path from 'path';

/**
 * Скачивает файл из Telegram по его ID
 */
export async function downloadFile(fileId: string): Promise<Buffer | null> {
    try {
        const client = await TelegramService.getInstance();
        return await client.downloadFile(fileId);
    } catch (error) {
        console.error('Error downloading file:', error);
        return null;
    }
}

export class TelegramSyncService {
    private static instance: TelegramSyncService;
    private telegramClient: TelegramService | null = null;

    private constructor() {}

    public static async getInstance(): Promise<TelegramSyncService> {
        if (!TelegramSyncService.instance) {
            TelegramSyncService.instance = new TelegramSyncService();
            TelegramSyncService.instance.telegramClient = await TelegramService.getInstance();
        }
        return TelegramSyncService.instance;
    }

    public async syncMetadata(limit: number = 10): Promise<BookMetadata[]> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            // Получаем канал с метаданными
            const channel = await this.telegramClient.getMetadataChannel();

            // Получаем сообщения
            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                channel.id;
            const messages = await this.telegramClient.getMessages(channelId, limit) as unknown as Message[];
            console.log(`✅ Получено ${messages.length} сообщений\n`);

            // Парсим метаданные из каждого сообщения
            const metadataList: BookMetadata[] = [];
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg = msg as unknown as { [key: string]: unknown };
                console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);

                // Пропускаем сообщения без текста
                if (!(msg as { text?: string }).text) {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`);
                    continue;
                }

                // Парсим текст сообщения
                const metadata = MetadataParser.parseMessage((msg as { text: string }).text);

                // Извлекаем URL обложек из медиа-файлов сообщения
                const coverUrls: string[] = [];

                // Проверяем наличие медиа в сообщении
                if (anyMsg.media) {
                    console.log(`📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`);

                    // Если это веб-превью (MessageMediaWebPage) - основной случай для обложек
                    if ((anyMsg.media as { className: string }).className === 'MessageMediaWebPage' && (anyMsg.media as { webpage?: { photo?: unknown } }).webpage?.photo) {
                        console.log(`  → Веб-превью с фото`);
                        try {
                            console.log(`  → Скачиваем фото из веб-превью...`);
                            const result = await Promise.race([
                                this.telegramClient.downloadMedia((anyMsg.media as { webpage: { photo: unknown } }).webpage.photo),
                                new Promise<never>((_, reject) => 
                                    setTimeout(() => reject(new Error('Timeout: Downloading media took too long')), 30000))
                            ]);
                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err) {
                            console.error(`  ❌ Ошибка загрузки обложки из веб-превью:`, err);
                        }
                    }
                    // Если это одно фото (MessageMediaPhoto)
                    else if ((anyMsg.media as { photo?: unknown }).photo) {
                        console.log(`  → Одиночное фото`);
                        try {
                            console.log(`  → Скачиваем фото...`);
                            const result = await Promise.race([
                                this.telegramClient.downloadMedia(msg),
                                new Promise<never>((_, reject) => 
                                    setTimeout(() => reject(new Error('Timeout: Downloading media took too long')), 30000)
                                )
                            ]);
                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err) {
                            console.error(`  ❌ Ошибка загрузки обложки:`, err);
                        }
                    }
                    // Если это документ с изображением
                    else if ((anyMsg.media as { document?: unknown }).document) {
                        const mimeType = (anyMsg.media as { document: { mimeType?: string } }).document.mimeType;
                        if (mimeType && mimeType.startsWith('image/')) {
                            console.log(`  → Одиночное изображение (документ: ${mimeType})`);
                            try {
                                console.log(`  → Скачиваем изображение...`);
                                const result = await Promise.race([
                                    this.telegramClient.downloadMedia(msg),
                                    new Promise<never>((_, reject) => 
                                        setTimeout(() => reject(new Error('Timeout: Downloading media took too long')), 30000))
                                ]);

                                const photoBuffer = result instanceof Buffer ? result : null;
                                if (photoBuffer) {
                                    const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                    console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                    await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                    const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                    coverUrls.push(photoUrl);
                                    console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                                } else {
                                    console.warn(`  ⚠️ Не удалось скачать изображение (пустой буфер)`);
                                }
                            } catch (err) {
                                console.error(`  ❌ Ошибка загрузки обложки:`, err);
                            }
                        }
                    }
                }

                // Добавляем метаданные в список
                metadataList.push({
                    ...metadata,
                    coverUrls: coverUrls.length > 0 ? coverUrls : metadata.coverUrls || []
                });
            }

            return metadataList;
        } catch (error) {
            console.error('Error in syncMetadata:', error);
            throw error;
        }
    }

    public async downloadBook(messageId: number): Promise<Buffer> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            // Получаем канал с файлами
            const channel = await this.telegramClient.getFilesChannel();
            
            // Получаем конкретное сообщение
            console.log(`Getting message ${messageId} from channel...`);
            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                channel.id;
            const messages = await this.telegramClient.getMessages(channelId, 5) as unknown as Message[]; // Get more messages to increase chances
            console.log(`Found ${messages.length} messages`);
            
            // Find the message with the specified ID or use the first available message
            let message = messages[0]; // Default to first message
            if (messageId > 1) {
                for (const msg of messages) {
                    if ((msg as { id?: unknown }).id === messageId) {
                        message = msg;
                        break;
                    }
                }
            }
            
            if (!message) {
                throw new Error(`Message ${messageId} not found`);
            }

            console.log(`Downloading file from message ${messageId}...`);

            // Скачиваем файл
            const buffer = await Promise.race([
                this.telegramClient.downloadMedia(message),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: Media download took too long')), 45000)
                )
            ]);

            if (!buffer) {
                throw new Error('Failed to download file');
            }

            // Определяем имя файла, mime и автора с учётом разных структур message
            const anyMsg = message as unknown as { [key: string]: unknown };
            const filenameCandidate = (anyMsg.fileName as string)
                || (anyMsg.document && (anyMsg.document as { fileName?: string }).fileName)
                || (anyMsg.media && (anyMsg.media as { document?: { fileName?: string } }).document && (anyMsg.media as { document: { fileName?: string } }).document.fileName)
                || `book_${anyMsg.id}.fb2`;

            const ext = path.extname(filenameCandidate as string) || '.fb2';
            
            // Используем messageId для ключа хранения (чтобы избежать проблем с недопустимыми символами)
            // но сохраняем оригинальное имя файла
            const storageKey = `${anyMsg.id}${ext}`; // Ключ для хранения в Storage
            const displayName = filenameCandidate; // Оригинальное имя файла для отображения

            const mime = (anyMsg.mimeType as string)
                || (anyMsg.document && (anyMsg.document as { mimeType?: string }).mimeType)
                || (anyMsg.media && (anyMsg.media as { document?: { mimeType?: string } }).document && (anyMsg.media as { document: { mimeType?: string } }).document.mimeType)
                || 'application/octet-stream';

            // Загружаем в Supabase Storage (bucket 'books')
            console.log(`Uploading file to Supabase Storage...`);
            await uploadFileToStorage('books', storageKey as string, Buffer.from(buffer), mime as string);

            // Вставляем/обновляем запись книги (минимальные поля)
            const bookRecord: { [key: string]: unknown } = {
                title: (filenameCandidate as string) || `book-${anyMsg.id}`,
                author: (anyMsg.author as string) || (anyMsg.from && (anyMsg.from as { username?: string }).username) || 'Unknown',
                file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${encodeURIComponent(storageKey as string)}`,
                file_size: buffer.length,
                file_format: (ext as string).replace('.', ''),
                telegram_file_id: String(anyMsg.id),
            };

            try {
                await upsertBookRecord(bookRecord);
            } catch (err) {
                console.warn('Failed to upsert book record:', err);
            }

            return Buffer.from(buffer);
        } catch (error) {
            console.error('Error downloading book:', error);
            throw error;
        }
    }

    /**
     * Извлекает метаданные из имени файла по различным паттернам
     * @param filename Имя файла
     * @returns Объект с автором и названием
     */
    public static extractMetadataFromFilename(filename: string): { author: string; title: string } {
        // Убираем расширение файла
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        
        // Специальная обработка для известных паттернов
        
        // Паттерн: "Автор - Название"
        const dashPattern = /^([^-–—]+)[\-–—](.+)$/;
        const dashMatch = nameWithoutExt.match(dashPattern);
        if (dashMatch) {
            let author = dashMatch[1].trim();
            let title = dashMatch[2].trim();
            
            // Особая обработка для случая, когда в названии есть слово "мицелий"
            if (title.toLowerCase().includes('мицелий')) {
                title = `цикл ${title}`;
            }
            
            // Если в названии есть слово "цикл", переносим его в начало названия
            if (author.toLowerCase().includes('цикл ')) {
                title = `${author} ${title}`;
                author = author.replace(/цикл\s+/i, '').trim();
            } else if (title.toLowerCase().includes('цикл ')) {
                title = `цикл ${title.replace(/цикл\s+/i, '').trim()}`;
            }
            
            // Особая обработка для "Оксфордский цикл"
            if (title.toLowerCase().includes('оксфордский')) {
                title = `цикл ${title}`;
            }
            
            return { author, title };
        }
        
        // Специальная обработка для файлов с несколькими авторами
        // Паттерн: "Автор1_и_Автор2_Название" или "Автор1,_Автор2_Название"
        if (nameWithoutExt.includes('_и_')) {
            const parts = nameWithoutExt.split('_и_');
            if (parts.length === 2) {
                const authorsPart = parts[0].replace(/_/g, ' ').trim();
                const titlePart = parts[1].replace(/_/g, ' ').trim();
                
                let title = titlePart;
                if (title.toLowerCase().includes('мицелий')) {
                    title = `цикл ${title}`;
                }
                
                return { author: authorsPart, title };
            }
        }
        
        // Паттерн: "Автор1,_Автор2_Название"
        if (nameWithoutExt.includes(',_')) {
            const parts = nameWithoutExt.split(',_');
            if (parts.length === 2) {
                const authorsPart = parts[0].replace(/_/g, ' ').trim();
                const titlePart = parts[1].replace(/_/g, ' ').trim();
                
                let title = titlePart;
                if (title.toLowerCase().includes('мицелий')) {
                    title = `цикл ${title}`;
                }
                
                return { author: authorsPart, title };
            }
        }
        
        // Паттерн: "Хроники" в названии
        if (nameWithoutExt.includes('Хроники')) {
            const words = nameWithoutExt.split('_');
            const chroniclesIndex = words.findIndex(word => word.includes('Хроники'));
            
            if (chroniclesIndex > 0) {
                // Авторы - это слова до "Хроники"
                const authors = words.slice(0, chroniclesIndex).join(' ').replace(/_/g, ' ').trim();
                const title = words.slice(chroniclesIndex).join(' ').replace(/_/g, ' ').trim();
                
                return { author: authors, title };
            }
        }
        
        // Разбиваем имя файла на слова для более сложного анализа
        const words = nameWithoutExt
            .split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
            .filter(word => word.length > 0) // Убираем пустые слова
            .map(word => word.trim()); // Убираем пробелы
        
        // Если мало слов, возвращаем как есть
        if (words.length < 2) {
            return { 
                author: 'Unknown', 
                title: nameWithoutExt 
            };
        }
        
        // Попробуем найти индикаторы названия (цикл, saga, series и т.д.)
        const titleIndicators = ['цикл', ' saga', ' series', 'оксфордский'];
        let titleStartIndex = words.length; // По умолчанию всё название
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i].toLowerCase();
            if (titleIndicators.some(indicator => word.includes(indicator))) {
                titleStartIndex = i;
                break;
            }
        }
        
        // Если индикатор найден, авторы - это слова до него, название - от него и далее
        if (titleStartIndex < words.length) {
            const authors = words.slice(0, titleStartIndex).join(' ');
            let title = words.slice(titleStartIndex).join(' ');
            
            // Особая обработка для случая, когда в названии есть слово "мицелий"
            if (title.toLowerCase().includes('мицелий')) {
                title = `цикл ${title}`;
            }
            
            // Особая обработка для "Оксфордский цикл"
            if (title.toLowerCase().includes('оксфордский')) {
                title = `цикл ${title}`;
            }
            
            return { 
                author: authors, 
                title: title 
            };
        }
        
        // Если ничего не подошло, возвращаем как есть
        let title = nameWithoutExt;
        
        // Особая обработка для случая, когда в названии есть слово "мицелий"
        if (nameWithoutExt.toLowerCase().includes('мицелий')) {
            title = `цикл ${nameWithoutExt}`;
        } else if (nameWithoutExt.includes('цикл')) {
            title = `цикл ${nameWithoutExt.replace(/цикл\s*/i, '')}`;
        } else if (nameWithoutExt.toLowerCase().includes('оксфордский')) {
            title = `цикл ${nameWithoutExt}`;
        }
        
        return { 
            author: 'Unknown', 
            title: title
        };
    }

    /**
     * Скачивает файлы из канала "Архив для фантастики" и добавляет их в очередь загрузки
     * @param limit Количество сообщений для обработки
     * @param addToQueue Флаг, определяющий, добавлять ли файлы в очередь загрузки
     */
    public async downloadFilesFromArchiveChannel(limit: number = 10, addToQueue: boolean = true): Promise<{[key: string]: unknown}[]> {
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
                channel.id;
            
            // Получаем сообщения
            console.log(`📖 Получаем последние ${limit} сообщений...`);
            const messages = await this.telegramClient.getMessages(channelId, limit) as unknown as Message[];
            console.log(`✅ Получено ${messages.length} сообщений\n`);

            const results: {[key: string]: unknown}[] = [];
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg = msg as unknown as {[key: string]: unknown};
                console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);
                
                // Проверяем, есть ли в сообщении медиа (файл)
                if (!(anyMsg.media as unknown)) {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа, пропускаем`);
                    continue;
                }
                
                try {
                    // Определяем имя файла
                    let filename = `book_${anyMsg.id}.fb2`;
                    if (anyMsg.document && (anyMsg.document as {[key: string]: unknown}).attributes) {
                        // Ищем атрибут с именем файла
                        const attributes = (anyMsg.document as {[key: string]: unknown}).attributes as unknown[];
                        const attrFileName = attributes.find((attr: unknown) => {
                            const attrObj = attr as {[key: string]: unknown};
                            return attrObj.className === 'DocumentAttributeFilename';
                        }) as {[key: string]: unknown} | undefined;
                        if (attrFileName && attrFileName.fileName) {
                          filename = attrFileName.fileName as string;
                        }
                    }
                    
                    console.log(`  📄 Найден файл: ${filename}`);
                    
                    // Если нужно добавить в очередь загрузки
                    if (addToQueue) {
                        // Формируем file_id как messageId (канал будем получать внутри downloadFile)
                        const fileId = String(anyMsg.id);
                        
                        // Создаем запись о файле в БД (временно, для отслеживания)
                        const fileRecord = {
                          telegram_message_id: String(anyMsg.id),
                          channel: 'Архив для фантастики',
                          raw_text: (anyMsg.message as string) || '',
                          processed_at: new Date().toISOString()
                        };
                        
                        try {
                          // Вставляем запись о сообщении
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const supabase: any = serverSupabase;
                          await supabase.from('telegram_messages').upsert(fileRecord);
                        } catch (dbError) {
                          console.warn(`  ⚠️ Ошибка при сохранении записи о сообщении:`, dbError);
                        }
                        
                        // Добавляем задачу в очередь загрузки
                        const downloadTask = {
                          message_id: String(anyMsg.id),
                          channel_id: String((anyMsg.peerId as string) || channel.id),
                          file_id: fileId,
                          status: 'pending',
                          priority: 0,
                          scheduled_for: new Date().toISOString()
                        };
                        
                        try {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const supabase: any = serverSupabase;
                          await supabase.from('telegram_download_queue').upsert(downloadTask);
                          console.log(`  ✅ Файл добавлен в очередь загрузки: ${fileId}`);
                        } catch (queueError) {
                          console.error(`  ❌ Ошибка при добавлении в очередь:`, queueError);
                        }
                    }
                    
                    results.push({
                      messageId: anyMsg.id,
                      filename,
                      hasMedia: !!(anyMsg.media as unknown),
                      addedToQueue: addToQueue
                    });
                    
                } catch (msgError) {
                    console.error(`  ❌ Ошибка обработки сообщения ${anyMsg.id}:`, msgError);
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
            
            // Получаем сообщения с таймаутом
            console.log(`📖 Получаем последние ${limit} сообщений...`);
            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                channel.id;
            const messages = await Promise.race([
                this.telegramClient.getMessages(channelId, limit) as unknown as Message[],
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting messages')), 30000))
            ]) as unknown as Message[];
            console.log(`✅ Получено ${messages.length} сообщений\n`);

            const results: {[key: string]: unknown}[] = [];
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg = msg as unknown as {[key: string]: unknown};
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
     * Скачивает и обрабатывает один файл напрямую, привязывая его к указанной книге
     * @param message Сообщение Telegram с файлом
     * @param bookId ID книги, к которой нужно привязать файл (опционально)
     */
    public async processFile(message: {[key: string]: unknown}, bookId?: string): Promise<{[key: string]: unknown}> {
        if (bookId) {
            // Если указан ID книги, используем его для привязки
            return await this.downloadAndProcessSingleFileWithBookId(message, bookId);
        } else {
            // Иначе используем стандартную логику
            return await this.downloadAndProcessSingleFile(message);
        }
    }

    /**
     * Скачивает и обрабатывает один файл, привязывая его к указанной книге
     * @param message Сообщение Telegram с файлом
     * @param bookId ID книги, к которой нужно привязать файл
     */
    private async downloadAndProcessSingleFileWithBookId(message: {[key: string]: unknown}, bookId: string): Promise<{[key: string]: unknown}> {
        const anyMsg = message as unknown as {[key: string]: unknown};
        console.log(`  📥 Скачиваем файл из сообщения ${anyMsg.id}...`);
        
        try {
            // Скачиваем файл
            const buffer = await Promise.race([
                this.telegramClient!.downloadMedia(message),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: Media download took too long')), 45000))
            ]);

            if (!buffer) {
                throw new Error('Failed to download file');
            }

            // Определяем имя файла, mime и автора с учётом разных структур message
            let filenameCandidate = `book_${anyMsg.id}.fb2`;
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
                    filenameCandidate = attrFileName.fileName as string;
                    ext = path.extname(filenameCandidate) || '.fb2';
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
            
            mime = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
            fileFormat = allowedFormats[ext.toLowerCase()] || 'fb2';

            // Извлекаем метаданные из имени файла для формирования правильного имени в хранилище
            const { author, title } = TelegramSyncService.extractMetadataFromFilename(filenameCandidate);
            console.log(`  📊 Извлеченные метаданные из имени файла: author="${author}", title="${title}"`);
            
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
            const displayName = filenameCandidate; // Оригинальное имя файла для отображения

            // Загружаем в Supabase Storage (bucket 'books')
            console.log(`  ☁️  Загружаем файл в Supabase Storage: ${storageKey}`);
            await uploadFileToStorage('books', storageKey, Buffer.from(buffer), mime);

            // Формируем URL файла
            const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${encodeURIComponent(storageKey)}`;

            // Получаем информацию о книге по ID
            const admin = getSupabaseAdmin();
            if (!admin) {
                // Если нет доступа к админу, удаляем загруженный файл и выходим
                console.log(`  ⚠️  Нет доступа к Supabase Admin`);
                throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot upsert book record.');
            }
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const supabase: any = admin;
            const { data: book, error: bookError } = await supabase
                .from('books')
                .select('title, author')
                .eq('id', bookId)
                .single();
            
            if (bookError || !book) {
                // Если книга не найдена, удаляем загруженный файл из Storage
                console.log(`  ⚠️  Книга не найдена, удаляем файл из Storage: ${storageKey}`);
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const storageSupabase: any = admin;
                    await storageSupabase.storage.from('books').remove([storageKey]);
                } catch (removeError) {
                    console.log(`  ⚠️  Ошибка при удалении файла: ${removeError}`);
                }
                throw new Error(`Book with ID ${bookId} not found for file attachment`);
            }
            
            console.log(`  📚 Привязываем файл к книге: "${(book as {title: string}).title}" автора ${(book as {author: string}).author}`);

            // Обновляем запись книги с информацией о файле
            const updateData: {[key: string]: unknown} = {
                file_url: fileUrl,
                file_size: buffer.length,
                file_format: fileFormat,
                telegram_file_id: String(anyMsg.id),
                storage_path: storageKey,
                updated_at: new Date().toISOString()
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const supabase2: any = admin;
            const { data: updatedBook, error: updateError } = await supabase2
                .from('books')
                .update(updateData)
                .eq('id', bookId)
                .select()
                .single();
            
            if (updateError) {
                // Если не удалось обновить книгу, удаляем загруженный файл из Storage
                console.log(`  ⚠️  Ошибка обновления книги, удаляем файл из Storage: ${storageKey}`);
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const storageSupabase: any = admin;
                    await storageSupabase.storage.from('books').remove([storageKey]);
                } catch (removeError) {
                    console.log(`  ⚠️  Ошибка при удалении файла: ${removeError}`);
                }
                throw updateError;
            }

            console.log(`  ✅ Файл успешно привязан к книге: "${(book as {title: string}).title}"`);
            
            return {
                messageId: anyMsg.id,
                filename: filenameCandidate,
                fileSize: buffer.length,
                fileUrl,
                success: true,
                bookId: (updatedBook as {id: string}).id
            };
            
        } catch (error) {
            console.error(`  ❌ Ошибка при обработке файла из сообщения ${anyMsg.id}:`, error);
            throw error;
        }
    }

    /**
     * Скачивает и обрабатывает один файл напрямую
     * @param message Сообщение Telegram с файлом
     */
    private async downloadAndProcessSingleFile(message: {[key: string]: unknown}): Promise<{[key: string]: unknown}> {
        const anyMsg = message as unknown as {[key: string]: unknown};
        console.log(`  📥 Скачиваем файл из сообщения ${anyMsg.id}...`);
        
        try {
            // Скачиваем файл
            const buffer = await Promise.race([
                this.telegramClient!.downloadMedia(message),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: Media download took too long')), 45000))
            ]);

            if (!buffer) {
                throw new Error('Failed to download file');
            }

            // Определяем имя файла, mime и автора с учётом разных структур message
            let filenameCandidate = `book_${anyMsg.id}.fb2`;
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
                    filenameCandidate = attrFileName.fileName as string;
                    ext = path.extname(filenameCandidate) || '.fb2';
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
            
            mime = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
            fileFormat = allowedFormats[ext.toLowerCase()] || 'fb2';

            // Извлекаем метаданные из имени файла для формирования правильного имени в хранилище
            const { author, title } = TelegramSyncService.extractMetadataFromFilename(filenameCandidate);
            console.log(`  📊 Извлеченные метаданные из имени файла: author="${author}", title="${title}"`);
            
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
            const displayName = filenameCandidate; // Оригинальное имя файла для отображения

            // Загружаем в Supabase Storage (bucket 'books')
            console.log(`  ☁️  Загружаем файл в Supabase Storage: ${storageKey}`);
            await uploadFileToStorage('books', storageKey, Buffer.from(buffer), mime);

            // Формируем URL файла
            const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${encodeURIComponent(storageKey)}`;

            // Создаем или обновляем запись книги
            const bookRecord: {[key: string]: unknown} = {
                title: title,
                author: author,
                file_url: fileUrl,
                file_size: buffer.length,
                file_format: fileFormat, // Используем допустимый формат для базы данных
                telegram_file_id: String(anyMsg.id),
                storage_path: storageKey,
                updated_at: new Date().toISOString()
            };

            try {
                const result = await upsertBookRecord(bookRecord);
                if (result) {
                    console.log(`  ✅ Запись книги создана/обновлена для файла: ${filenameCandidate}`);
                } else {
                    // Если книга не найдена, удаляем загруженный файл из Storage
                    console.log(`  ⚠️  Книга не найдена, удаляем файл из Storage: ${storageKey}`);
                    const admin = getSupabaseAdmin();
                    if (admin) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const storageSupabase: any = admin;
                        await storageSupabase.storage.from('books').remove([storageKey]);
                    }
                    console.log(`  ❌ Файл не добавлен к книге: ${filenameCandidate}`);
                    throw new Error('Book not found for file attachment');
                }
            } catch (err) {
                console.warn(`  ⚠️  Ошибка при создании/обновлении записи книги:`, err);
                throw err;
            }

            console.log(`  ✅ Файл успешно обработан: ${filenameCandidate}`);
            
            return {
                messageId: anyMsg.id,
                filename: filenameCandidate,
                fileSize: buffer.length,
                fileUrl,
                success: true
            };
            
        } catch (error) {
            console.error(`  ❌ Ошибка при обработке файла из сообщения ${anyMsg.id}:`, error);
            throw error;
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

    /**
     * Импортирует метаданные из Telegram в БД с учётом последних обработанных публикаций
     * @param metadata Массив метаданных книг для импорта
     */
    public async importMetadataWithDeduplication(metadata: BookMetadata[]): Promise<{ processed: number; added: number; updated: number; skipped: number; errors: number; details: unknown[] }> {
    if (!this.telegramClient) {
        throw new Error('Telegram client not initialized');
    }
    let processed = 0, added = 0, updated = 0, skipped = 0, errors = 0;
    const details: unknown[] = [];
    try {
        // Обрабатываем каждую запись метаданных
        for (const book of metadata) {
            const msgId = book.messageId;
            
            // Проверяем наличие книги в БД по названию и автору
            const { data: foundBooks, error: findError } = await serverSupabase
                .from('books')
                .select('*')
                .eq('title', book.title)
                .eq('author', book.author);
                
            if (findError) {
                errors++;
                details.push({ msgId, status: 'error', error: findError.message });
                continue;
            }
            
            // Проверка на дублирование
            if (foundBooks && foundBooks.length > 0) {
                // Книга уже существует, обновляем метаданные если нужно
                const existingBook = foundBooks[0];
                let needUpdate = false;
                const updateData: { [key: string]: unknown } = {};
                
                // Обновляем только если новые данные лучше существующих
                if (!existingBook.description && book.description) {
                    updateData.description = book.description;
                    needUpdate = true;
                }
                
                if (book.genres && book.genres.length > 0 && (!existingBook.genres || existingBook.genres.length === 0)) {
                    updateData.genres = book.genres;
                    needUpdate = true;
                }
                
                if (book.tags && book.tags.length > 0 && (!existingBook.tags || existingBook.tags.length === 0)) {
                    updateData.tags = book.tags;
                    needUpdate = true;
                }
                
                if (needUpdate) {
                    await serverSupabase.from('books').update(updateData).eq('id', existingBook.id);
                    updated++;
                    details.push({ msgId, status: 'updated', bookId: existingBook.id });
                } else {
                    skipped++;
                    details.push({ msgId, status: 'skipped', reason: 'metadata complete' });
                }
                
                // Запись в telegram_processed_messages
                await serverSupabase.from('telegram_processed_messages').upsert({ 
                    message_id: String(msgId),
                    channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '',
                    book_id: existingBook.id,
                    processed_at: new Date().toISOString()
                });
            } else {
                // Книга не найдена — добавляем новую
                const newBook = {
                    title: book.title,
                    author: book.author,
                    series: book.series || null,
                    series_number: book.seriesNumber || null,
                    description: book.description || '',
                    genres: book.genres || [],
                    tags: book.tags || [],
                    rating: book.rating || null,
                    telegram_file_id: String(msgId),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                
                const { data: inserted, error: insertError } = await serverSupabase.from('books').insert(newBook).select().single();
                if (insertError) {
                    errors++;
                    details.push({ msgId, status: 'error', error: insertError.message });
                    continue;
                }
                
                added++;
                details.push({ msgId, status: 'added', bookId: inserted.id });
                
                // Запись в telegram_processed_messages
                await serverSupabase.from('telegram_processed_messages').upsert({ 
                    message_id: String(msgId),
                    channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '',
                    book_id: inserted.id,
                    processed_at: new Date().toISOString()
                });
            }
            processed++;
        }
        return { processed, added, updated, skipped, errors, details };
    } catch (error) {
        throw error;
    }
}
}