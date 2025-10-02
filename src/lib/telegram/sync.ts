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

            for (const msg of messages) {
                const anyMsg: any = msg as any;

                // Пропускаем сообщения без текста
                if (!msg.text) {
                    // Но если это часть альбома, сохраняем groupedId для обработки
                    if (anyMsg.groupedId) {
                        processedGroupIds.add(String(anyMsg.groupedId));
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
                            const photoBuffer = await this.telegramClient.downloadMedia(anyMsg.media.webpage.photo);
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

                            // Находим все сообщения с этим groupedId
                            const groupMessages = messages.filter((m: any) => String(m.groupedId) === groupId);
                            console.log(`  → Найдено ${groupMessages.length} фото в альбоме`);

                            // Скачиваем все фото из группы
                            for (const groupMsg of groupMessages) {
                                const groupAnyMsg: any = groupMsg;
                                if (groupAnyMsg.media?.photo) {
                                    try {
                                        console.log(`  → Скачиваем фото ${groupAnyMsg.id} из альбома...`);
                                        const photoBuffer = await this.telegramClient.downloadMedia(groupMsg);
                                        if (photoBuffer) {
                                            const photoKey = `${groupAnyMsg.id}_${Date.now()}.jpg`;
                                            console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                            await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                            const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                            coverUrls.push(photoUrl);
                                            console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                                        } else {
                                            console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
                                        }
                                    } catch (err) {
                                        console.error(`  ❌ Ошибка загрузки обложки из альбома:`, err);
                                    }
                                }
                            }
                        }
                    }
                    // Если это одно фото (MessageMediaPhoto)
                    else if (anyMsg.media.photo) {
                        console.log(`  → Одиночное фото`);
                        try {
                            console.log(`  → Скачиваем фото...`);
                            const photoBuffer = await this.telegramClient.downloadMedia(msg);
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
                    } else {
                        console.log(`  → Медиа не содержит фото`);
                    }
                } else {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит медиа`);
                }

                // Добавляем URL обложек к метаданным
                metadata.coverUrls = coverUrls.length > 0 ? coverUrls : undefined;

                metadataList.push(metadata);
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