import { TelegramService } from './client';
import { MetadataParser, BookMetadata } from './parser';
import { uploadFileToStorage, upsertBookRecord } from '../supabase';
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
            const messages = await this.telegramClient.getMessages(channel, 1);
            const message = messages[0];

            if (!message) {
                throw new Error('Message not found');
            }

            // Скачиваем файл
            const buffer = await this.telegramClient.downloadMedia(message);

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
            const key = `books/${anyMsg.id}${ext}`;

            const mime = anyMsg.mimeType
                || (anyMsg.document && anyMsg.document.mimeType)
                || (anyMsg.media && anyMsg.media.document && anyMsg.media.document.mimeType)
                || 'application/octet-stream';

            // Загружаем в Supabase Storage (bucket 'books')
            await uploadFileToStorage('books', key, Buffer.from(buffer), mime);

            // Вставляем/обновляем запись книги (минимальные поля)
            const bookRecord: any = {
                title: filenameCandidate || `book-${anyMsg.id}`,
                author: anyMsg.author || (anyMsg.from && anyMsg.from.username) || 'Unknown',
                file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${encodeURIComponent(key)}`,
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

    public async shutdown(): Promise<void> {
        if (this.telegramClient && typeof (this.telegramClient as any).disconnect === 'function') {
            try {
                await (this.telegramClient as any).disconnect();
            } catch (err) {
                console.warn('Error during shutdown:', err);
            }
        }
    }
}