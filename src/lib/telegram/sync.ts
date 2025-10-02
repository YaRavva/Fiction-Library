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

            for (const msg of messages) {
                if (!msg.text) continue;

                // Парсим текст сообщения
                const metadata = MetadataParser.parseMessage(msg.text);

                // Извлекаем URL обложек из медиа-файлов сообщения
                const coverUrls: string[] = [];
                const anyMsg: any = msg as any;

                // Проверяем наличие медиа в сообщении
                if (anyMsg.media) {
                    // Если это группа медиа (альбом)
                    if (anyMsg.groupedId && anyMsg.media.photo) {
                        // Скачиваем фото и загружаем в Supabase Storage
                        try {
                            const photoBuffer = await this.telegramClient.downloadMedia(msg);
                            if (photoBuffer) {
                                const photoKey = `covers/${anyMsg.id}_${Date.now()}.jpg`;
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${encodeURIComponent(photoKey)}`;
                                coverUrls.push(photoUrl);
                            }
                        } catch (err) {
                            console.warn('Failed to download cover:', err);
                        }
                    }
                    // Если это одно фото
                    else if (anyMsg.media.photo) {
                        try {
                            const photoBuffer = await this.telegramClient.downloadMedia(msg);
                            if (photoBuffer) {
                                const photoKey = `covers/${anyMsg.id}_${Date.now()}.jpg`;
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${encodeURIComponent(photoKey)}`;
                                coverUrls.push(photoUrl);
                            }
                        } catch (err) {
                            console.warn('Failed to download cover:', err);
                        }
                    }
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