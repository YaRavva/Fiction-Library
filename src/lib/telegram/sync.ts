import { TelegramService } from './client';
import { MetadataParser, BookMetadata } from './parser';
import { uploadFileToStorage, upsertBookRecord, getSupabaseAdmin } from '../supabase';
import { serverSupabase } from '../serverSupabase';
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
            const messages = await this.telegramClient.getMessages(channel, limit);

            // Парсим метаданные из каждого сообщения
            const metadataList: BookMetadata[] = [];
            const processedGroupIds = new Set<string>();
            const groupedMessagesMap = new Map<string, any[]>();

            // First pass: collect all grouped messages
            for (const msg of messages) {
                const anyMsg: any = msg as any;
                if (anyMsg.groupedId) {
                    const groupId = String(anyMsg.groupedId);
                    if (!groupedMessagesMap.has(groupId)) {
                        groupedMessagesMap.set(groupId, []);
                    }
                    groupedMessagesMap.get(groupId)!.push(msg);
                }
            }

            // Second pass: process messages
            for (const msg of messages) {
                const anyMsg: any = msg as any;

                // Пропускаем сообщения без текста (но не пропускаем если это часть необработанной группы)
                if (!msg.text) {
                    // Если это часть альбома, проверим, обработана ли группа
                    if (anyMsg.groupedId) {
                        const groupId = String(anyMsg.groupedId);
                        if (!processedGroupIds.has(groupId)) {
                            // Группа еще не обработана, но у этого сообщения нет текста
                            // Мы обработаем группу позже с сообщением, у которого есть текст
                            console.log(`  → Сообщение ${anyMsg.id} без текста, часть группы ${groupId}, будет обработано позже`);
                        }
                    }
                    continue;
                }

                // Парсим текст сообщения
                const metadata = MetadataParser.parseMessage(msg.text);

                // Извлекаем URL обложек из медиа-файлов сообщения
                const coverUrls: string[] = [];

                // Проверяем наличие медиа в сообщении
                if (anyMsg.media) {
                    console.log(`📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${anyMsg.media.className})`);

                    // Если это веб-превью (MessageMediaWebPage) - основной случай для обложек
                    if (anyMsg.media.className === 'MessageMediaWebPage' && anyMsg.media.webpage?.photo) {
                        console.log(`  → Веб-превью с фото`);
                        try {
                            console.log(`  → Скачиваем фото из веб-превью...`);
                            const result = await this.telegramClient.downloadMedia(anyMsg.media.webpage.photo);
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
                    // Если это группа медиа (альбом) - собираем все фото из группы
                    else if (anyMsg.groupedId) {
                        const groupId = String(anyMsg.groupedId);

                        // Обрабатываем группу только один раз
                        if (!processedGroupIds.has(groupId)) {
                            processedGroupIds.add(groupId);
                            console.log(`  → Группа медиа (альбом), groupedId: ${groupId}`);

                            // Получаем все сообщения из этой группы
                            const groupMessages = groupedMessagesMap.get(groupId) || [];
                            console.log(`  → Найдено ${groupMessages.length} элементов в альбоме`);

                            // Скачиваем все медиа из группы
                            let coverCount = 0;
                            for (const groupMsg of groupMessages) {
                                const groupAnyMsg: any = groupMsg;
                                try {
                                    // Проверяем разные типы медиа
                                    let photoBuffer: Buffer | null = null;
                                    
                                    // MessageMediaPhoto
                                    if (groupAnyMsg.media?.photo) {
                                        console.log(`  → Скачиваем фото ${groupAnyMsg.id} из альбома (MessageMediaPhoto)...`);
                                        const result = await this.telegramClient.downloadMedia(groupMsg);
                                        photoBuffer = result instanceof Buffer ? result : null;
                                    }
                                    // MessageMediaDocument с изображением
                                    else if (groupAnyMsg.media?.document) {
                                        const mimeType = groupAnyMsg.media.document.mimeType;
                                        if (mimeType && mimeType.startsWith('image/')) {
                                            console.log(`  → Скачиваем изображение ${groupAnyMsg.id} из альбома (MessageMediaDocument: ${mimeType})...`);
                                            const result = await this.telegramClient.downloadMedia(groupMsg);
                                            photoBuffer = result instanceof Buffer ? result : null;
                                        } else {
                                            console.log(`  → Пропускаем документ ${groupAnyMsg.id} (тип: ${mimeType})`);
                                        }
                                    } else {
                                        console.log(`  → Пропускаем сообщение ${groupAnyMsg.id} (нет медиа или неподдерживаемый тип)`);
                                        console.log(`    Медиа:`, JSON.stringify(groupAnyMsg.media || 'none', null, 2));
                                    }

                                    if (photoBuffer) {
                                        const photoKey = `${groupAnyMsg.id}_${Date.now()}.jpg`;
                                        console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                        await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                        const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                        coverUrls.push(photoUrl);
                                        coverCount++;
                                        console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                                    } else {
                                        console.warn(`  ⚠️ Не удалось скачать медиа (пустой буфер) для сообщения ${groupAnyMsg.id}`);
                                    }
                                } catch (err) {
                                    console.error(`  ❌ Ошибка загрузки медиа из альбома (сообщение ${groupAnyMsg?.id}):`, err);
                                }
                            }
                            console.log(`  → Всего загружено обложек из альбома: ${coverCount}`);
                        } else {
                            console.log(`  → Группа ${groupId} уже обработана, пропускаем`);
                        }
                    }
                    // Если это одно фото (MessageMediaPhoto)
                    else if (anyMsg.media.photo) {
                        console.log(`  → Одиночное фото`);
                        try {
                            console.log(`  → Скачиваем фото...`);
                            const result = await this.telegramClient.downloadMedia(msg);
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
                    else if (anyMsg.media.document) {
                        const mimeType = anyMsg.media.document.mimeType;
                        if (mimeType && mimeType.startsWith('image/')) {
                            console.log(`  → Одиночное изображение (документ: ${mimeType})`);
                            try {
                                console.log(`  → Скачиваем изображение...`);
                                const result = await this.telegramClient.downloadMedia(msg);
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
                                console.error(`  ❌ Ошибка загрузки изображения:`, err);
                            }
                        } else {
                            console.log(`  → Медиа не содержит фото (документ: ${mimeType})`);
                        }
                    } else {
                        console.log(`  → Медиа не содержит фото`);
                    }
                } else {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа`);
                }

                // Добавляем URL обложек к метаданным
                metadata.coverUrls = coverUrls.length > 0 ? coverUrls : undefined;
                
                // Debug logging
                console.log(`  → Итоговое количество обложек для "${metadata.title}": ${coverUrls.length}`);
                if (coverUrls.length > 0) {
                    console.log(`  → Обложки:`, coverUrls);
                }

                metadataList.push(metadata);
            }

            console.log(`\n📊 Всего обработано записей: ${metadataList.length}`);
            for (let i = 0; i < metadataList.length; i++) {
                const meta = metadataList[i];
                console.log(`  ${i + 1}. "${meta.title}" - ${meta.coverUrls?.length || 0} обложек`);
            }

            return metadataList;
        } catch (error) {
            console.error('Error syncing metadata:', error);
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
            const messages = await this.telegramClient.getMessages(channel, 5); // Get more messages to increase chances
            console.log(`Found ${messages.length} messages`);
            
            // Find the message with the specified ID or use the first available message
            let message = messages[0]; // Default to first message
            if (messageId > 1) {
                for (const msg of messages) {
                    // @ts-ignore
                    if (msg.id === messageId) {
                        message = msg;
                        break;
                    }
                }
            }
            
            if (!message) {
                throw new Error(`Message ${messageId} not found`);
            }

            // @ts-ignore
            console.log(`Downloading file from message ${message.id}...`);

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
            const anyMsg: any = message as any;
            const filenameCandidate = anyMsg.fileName
                || (anyMsg.document && anyMsg.document.fileName)
                || (anyMsg.media && anyMsg.media.document && anyMsg.media.document.fileName)
                || `book_${anyMsg.id}.fb2`;

            const ext = path.extname(filenameCandidate) || '.fb2';
            
            // Используем messageId для ключа хранения (чтобы избежать проблем с недопустимыми символами)
            // но сохраняем оригинальное имя файла
            const storageKey = `${anyMsg.id}${ext}`; // Ключ для хранения в Storage
            const displayName = filenameCandidate; // Оригинальное имя файла для отображения

            const mime = anyMsg.mimeType
                || (anyMsg.document && anyMsg.document.mimeType)
                || (anyMsg.media && anyMsg.media.document && anyMsg.media.document.mimeType)
                || 'application/octet-stream';

            // Загружаем в Supabase Storage (bucket 'books')
            console.log(`Uploading file to Supabase Storage...`);
            await uploadFileToStorage('books', storageKey, Buffer.from(buffer), mime);

            // Вставляем/обновляем запись книги (минимальные поля)
            const bookRecord: any = {
                title: filenameCandidate || `book-${anyMsg.id}`,
                author: anyMsg.author || (anyMsg.from && anyMsg.from.username) || 'Unknown',
                file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${encodeURIComponent(storageKey)}`,
                file_size: buffer.length,
                file_format: ext.replace('.', ''),
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
    public async downloadFilesFromArchiveChannel(limit: number = 10, addToQueue: boolean = true): Promise<any[]> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            // Получаем канал с файлами
            console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
            const channel = await this.telegramClient.getFilesChannel();
            
            // Получаем сообщения
            console.log(`📖 Получаем последние ${limit} сообщений...`);
            const messages = await this.telegramClient.getMessages(channel, limit);
            console.log(`✅ Получено ${messages.length} сообщений\n`);

            const results: any[] = [];
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg: any = msg as any;
                console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);
                
                // Проверяем, есть ли в сообщении медиа (файл)
                if (!anyMsg.media) {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа, пропускаем`);
                    continue;
                }
                
                try {
                    // Определяем имя файла
                    let filename = `book_${anyMsg.id}.fb2`;
                    if (anyMsg.document && anyMsg.document.attributes) {
                        // Ищем атрибут с именем файла
                        const attrFileName = anyMsg.document.attributes.find((attr: any) => 
                          attr.className === 'DocumentAttributeFilename'
                        );
                        if (attrFileName && attrFileName.fileName) {
                          filename = attrFileName.fileName;
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
                          raw_text: anyMsg.message || '',
                          processed_at: new Date().toISOString()
                        };
                        
                        try {
                          // Вставляем запись о сообщении
                          await (serverSupabase.from('telegram_messages') as any).upsert(fileRecord);
                        } catch (dbError) {
                          console.warn(`  ⚠️ Ошибка при сохранении записи о сообщении:`, dbError);
                        }
                        
                        // Добавляем задачу в очередь загрузки
                        const downloadTask = {
                          message_id: String(anyMsg.id),
                          channel_id: String(anyMsg.peerId || channel.id),
                          file_id: fileId,
                          status: 'pending',
                          priority: 0,
                          scheduled_for: new Date().toISOString()
                        };
                        
                        try {
                          await (serverSupabase.from('telegram_download_queue') as any).upsert(downloadTask);
                          console.log(`  ✅ Файл добавлен в очередь загрузки: ${fileId}`);
                        } catch (queueError) {
                          console.error(`  ❌ Ошибка при добавлении в очередь:`, queueError);
                        }
                    }
                    
                    results.push({
                      messageId: anyMsg.id,
                      filename,
                      hasMedia: !!anyMsg.media,
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
    public async downloadAndProcessFilesDirectly(limit: number = 10): Promise<any[]> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            // Получаем канал с файлами
            console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
            const channel = await this.telegramClient.getFilesChannel();
            
            // Получаем сообщения
            console.log(`📖 Получаем последние ${limit} сообщений...`);
            const messages = await this.telegramClient.getMessages(channel, limit);
            console.log(`✅ Получено ${messages.length} сообщений\n`);

            const results: any[] = [];
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg: any = msg as any;
                console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);
                
                // Проверяем, есть ли в сообщении медиа (файл)
                if (!anyMsg.media) {
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
    public async processFile(message: any, bookId?: string): Promise<any> {
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
    private async downloadAndProcessSingleFileWithBookId(message: any, bookId: string): Promise<any> {
        const anyMsg: any = message as any;
        console.log(`  📥 Скачиваем файл из сообщения ${anyMsg.id}...`);
        
        try {
            // Скачиваем файл
            const buffer = await Promise.race([
                this.telegramClient!.downloadMedia(message),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: Media download took too long')), 45000)
                )
            ]);

            if (!buffer) {
                throw new Error('Failed to download file');
            }

            // Определяем имя файла, mime и автора с учётом разных структур message
            let filenameCandidate = `book_${anyMsg.id}.fb2`;
            let ext = '.fb2';
            let mime = 'application/octet-stream';
            let fileFormat = 'fb2';

            if (anyMsg.document && anyMsg.document.attributes) {
                const attrFileName = anyMsg.document.attributes.find((attr: any) => 
                    attr.className === 'DocumentAttributeFilename'
                );
                if (attrFileName && attrFileName.fileName) {
                    filenameCandidate = attrFileName.fileName;
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

            // Санитизируем имя файла для использования в Storage (удаляем недопустимые символы)
            const sanitizedFilename = filenameCandidate
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Заменяем недопустимые символы на подчеркивание
                .replace(/^\.+/, '') // Удаляем точки в начале
                .replace(/\.+$/, '') // Удаляем точки в конце
                .substring(0, 255); // Ограничиваем длину имени файла

            // Используем messageId для ключа хранения (чтобы избежать проблем с недопустимыми символами)
            // но сохраняем оригинальное имя файла
            const storageKey = `${anyMsg.id}${ext}`; // Ключ для хранения в Storage
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
            
            const { data: book, error: bookError } = await (admin as any)
                .from('books')
                .select('title, author')
                .eq('id', bookId)
                .single();
            
            if (bookError || !book) {
                // Если книга не найдена, удаляем загруженный файл из Storage
                console.log(`  ⚠️  Книга не найдена, удаляем файл из Storage: ${storageKey}`);
                try {
                    await admin.storage.from('books').remove([storageKey]);
                } catch (removeError) {
                    console.log(`  ⚠️  Ошибка при удалении файла: ${removeError}`);
                }
                throw new Error(`Book with ID ${bookId} not found for file attachment`);
            }
            
            console.log(`  📚 Привязываем файл к книге: "${book.title}" автора ${book.author}`);

            // Обновляем запись книги с информацией о файле
            const updateData: any = {
                file_url: fileUrl,
                file_size: buffer.length,
                file_format: fileFormat,
                telegram_file_id: String(anyMsg.id),
                storage_path: storageKey,
                updated_at: new Date().toISOString()
            };

            const { data: updatedBook, error: updateError } = await (admin as any)
                .from('books')
                .update(updateData)
                .eq('id', bookId)
                .select()
                .single();
            
            if (updateError) {
                // Если не удалось обновить книгу, удаляем загруженный файл из Storage
                console.log(`  ⚠️  Ошибка обновления книги, удаляем файл из Storage: ${storageKey}`);
                try {
                    await admin.storage.from('books').remove([storageKey]);
                } catch (removeError) {
                    console.log(`  ⚠️  Ошибка при удалении файла: ${removeError}`);
                }
                throw updateError;
            }

            console.log(`  ✅ Файл успешно привязан к книге: "${book.title}"`);
            
            return {
                messageId: anyMsg.id,
                filename: filenameCandidate,
                fileSize: buffer.length,
                fileUrl,
                success: true,
                bookId: updatedBook.id
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
    private async downloadAndProcessSingleFile(message: any): Promise<any> {
        const anyMsg: any = message as any;
        console.log(`  📥 Скачиваем файл из сообщения ${anyMsg.id}...`);
        
        try {
            // Скачиваем файл
            const buffer = await Promise.race([
                this.telegramClient!.downloadMedia(message),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: Media download took too long')), 45000)
                )
            ]);

            if (!buffer) {
                throw new Error('Failed to download file');
            }

            // Определяем имя файла, mime и автора с учётом разных структур message
            let filenameCandidate = `book_${anyMsg.id}.fb2`;
            let ext = '.fb2';
            let mime = 'application/octet-stream';
            let fileFormat = 'fb2';

            if (anyMsg.document && anyMsg.document.attributes) {
                const attrFileName = anyMsg.document.attributes.find((attr: any) => 
                    attr.className === 'DocumentAttributeFilename'
                );
                if (attrFileName && attrFileName.fileName) {
                    filenameCandidate = attrFileName.fileName;
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

            // Санитизируем имя файла для использования в Storage (удаляем недопустимые символы)
            const sanitizedFilename = filenameCandidate
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Заменяем недопустимые символы на подчеркивание
                .replace(/^\.+/, '') // Удаляем точки в начале
                .replace(/\.+$/, '') // Удаляем точки в конце
                .substring(0, 255); // Ограничиваем длину имени файла

            // Используем messageId для ключа хранения (чтобы избежать проблем с недопустимыми символами)
            // но сохраняем оригинальное имя файла
            const storageKey = `${anyMsg.id}${ext}`; // Ключ для хранения в Storage
            const displayName = filenameCandidate; // Оригинальное имя файла для отображения

            // Загружаем в Supabase Storage (bucket 'books')
            console.log(`  ☁️  Загружаем файл в Supabase Storage: ${storageKey}`);
            await uploadFileToStorage('books', storageKey, Buffer.from(buffer), mime);

            // Формируем URL файла
            const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${encodeURIComponent(storageKey)}`;

            // Извлекаем метаданные из имени файла
            const { author, title } = TelegramSyncService.extractMetadataFromFilename(filenameCandidate);
            console.log(`  📊 Извлеченные метаданные из имени файла: author="${author}", title="${title}"`);

            // Создаем или обновляем запись книги
            const bookRecord: any = {
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
                        await admin.storage.from('books').remove([storageKey]);
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
        if (this.telegramClient && typeof (this.telegramClient as any).disconnect === 'function') {
            try {
                // Добавляем таймаут для принудительного завершения
                await Promise.race([
                    (this.telegramClient as any).disconnect(),
                    new Promise(resolve => setTimeout(resolve, 3000)) // 3 секунды таймаут
                ]);
            } catch (err) {
                console.warn('Error during shutdown:', err);
            }
        }
    }
}