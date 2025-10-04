import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';

/**
 * TelegramService — GramJS wrapper that uses TELEGRAM_SESSION from .env
 * Provides: getMetadataChannel, getFilesChannel, getMessages, downloadMedia
 */
export class TelegramService {
    private client: TelegramClient;
    private static instance: TelegramService | null = null;

    private constructor(sessionString: string, apiId: number, apiHash: string) {
        const session = new StringSession(sessionString || '');
        this.client = new TelegramClient(session, apiId, apiHash, {
            connectionRetries: 5,
        });
    }

    public static async getInstance(): Promise<TelegramService> {
        if (TelegramService.instance) return TelegramService.instance;

        const apiIdRaw = process.env.TELEGRAM_API_ID;
        const apiHash = process.env.TELEGRAM_API_HASH;
        const sessionString = process.env.TELEGRAM_SESSION || '';

        if (!apiIdRaw || !apiHash) {
            throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
        }

        const apiId = parseInt(apiIdRaw, 10);
        TelegramService.instance = new TelegramService(sessionString, apiId, apiHash);

        // Start the client. If sessionString is empty, this will require interactive login which we avoid here.
        await TelegramService.instance.client.start({
            phoneNumber: async () => await Promise.reject('Interactive login not supported here'),
            phoneCode: async () => await Promise.reject('Interactive login not supported here'),
            password: async () => await Promise.reject('Interactive login not supported here'),
            onError: (err) => console.error('Telegram client error:', err),
        });

        return TelegramService.instance;
    }

    /**
     * Скачивает файл по его Telegram file_id
     */
    public async downloadFile(fileId: string): Promise<Buffer> {
        try {
            // Получаем сообщение с файлом
            const messageId = Number(fileId);
            
            // Получаем канал с файлами
            const channel = await this.getFilesChannel();
            
            // Получаем сообщения и ищем нужное
            const messages = await this.getMessages(channel, 20); // Получаем больше сообщений для увеличения шансов
            
            // Ищем сообщение с указанным ID
            let targetMessage = null;
            if (Array.isArray(messages)) {
                for (const msg of messages) {
                    // @ts-ignore
                    if (msg && msg.id === messageId) {
                        targetMessage = msg;
                        break;
                    }
                }
            }
            
            if (!targetMessage) {
                throw new Error(`Message with ID ${messageId} not found`);
            }
            
            if (!targetMessage.media) {
                throw new Error(`Message with ID ${messageId} has no media`);
            }

            // Скачиваем файл
            const buffer = await this.downloadMedia(targetMessage);

            if (buffer instanceof Buffer) {
                return buffer;
            }
            
            throw new Error('Downloaded content is not a Buffer');
        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    public async getMetadataChannel() {
        const identifier = process.env.TELEGRAM_METADATA_CHANNEL;
        if (!identifier) throw new Error('TELEGRAM_METADATA_CHANNEL not set');

        // Accept full URL or username
        const username = identifier.split('/').pop() || identifier;
        try {
            return await this.client.getEntity(username);
        } catch (err) {
            console.error('Error resolving metadata channel:', err);
            throw err;
        }
    }

    public async getFilesChannel() {
        const url = process.env.TELEGRAM_FILES_CHANNEL;
        const hash = process.env.TELEGRAM_FILES_CHANNEL_HASH;
        if (!url && !hash) throw new Error('TELEGRAM_FILES_CHANNEL or TELEGRAM_FILES_CHANNEL_HASH must be set');

        try {
            // Try different methods to access the channel
            
            // Method 1: Try to get all dialogs and find the channel by name
            try {
                console.log('Method 1: Getting dialogs to find the channel by name...');
                const dialogs = await this.client.getDialogs();
                console.log(`Found ${dialogs.length} dialogs`);
                
                // Look for the specific channel by name
                for (const dialog of dialogs) {
                    try {
                        // @ts-ignore
                        if (dialog.entity && dialog.entity.className === 'Channel') {
                            // @ts-ignore
                            const channelTitle = dialog.entity.title || '';
                            console.log(`Found channel: ${channelTitle}`);
                            
                            // Check if this is our target channel
                            if (channelTitle.includes('Архив для фантастики') || 
                                channelTitle.includes('Archive for fiction') ||
                                channelTitle.includes('фантастики')) {
                                // @ts-ignore
                                console.log(`Found target files channel: ${dialog.entity.title} (ID: ${dialog.entity.id})`);
                                // @ts-ignore
                                return dialog.entity;
                            }
                        }
                    } catch (e) {
                        // Skip entities we can't access
                    }
                }
            } catch (e: any) {
                console.warn('Could not get dialogs:', e.message);
            }

            // Method 2: Try join by invite (but ignore if already a member)
            if (hash) {
                try {
                    console.log('Method 2: Trying to join channel by invite hash...');
                    await this.client.invoke(new (await import('telegram')).Api.messages.ImportChatInvite({ hash }));
                    console.log('Successfully joined channel (or already a member)');
                } catch (e: any) {
                    if (e.errorMessage === 'USER_ALREADY_PARTICIPANT') {
                        console.log('Already a member of the channel');
                    } else {
                        console.warn('Could not join files channel by invite:', e.message);
                    }
                }
            }

            // Method 3: Try with hash directly
            if (hash) {
                try {
                    console.log('Method 3: Trying to get entity with hash directly...');
                    return await this.client.getEntity(hash);
                } catch (e: any) {
                    console.warn('Could not get entity with hash directly:', e.message);
                }
            }
            
            // Method 4: Try with full URL
            try {
                if (url) {
                    console.log('Method 4: Trying to get entity with full URL...');
                    return await this.client.getEntity(url);
                }
            } catch (e: any) {
                console.warn('Could not get entity with full URL:', e.message);
            }
            
            throw new Error(`Cannot access files channel with identifier: ${url || hash}`);
        } catch (err) {
            console.error('Error getting files channel:', err);
            throw err;
        }
    }

    public async getMessages(entity: any, limit = 10, offsetId?: number) {
        try {
            const params: any = { limit };
            if (offsetId) {
                params.offsetId = offsetId;
            }
            return await this.client.getMessages(entity, params);
        } catch (err) {
            console.error('Error getting messages:', err);
            throw err;
        }
    }

    public async downloadMedia(messageOrMedia: any) {
        try {
            // Если это сообщение с медиа
            if (messageOrMedia.document || messageOrMedia.media) {
                return await this.client.downloadMedia(messageOrMedia);
            }
            // Если это объект Photo (из веб-превью или альбома)
            else if (messageOrMedia.className === 'Photo') {
                return await this.client.downloadMedia(messageOrMedia);
            }
            // Если это другой медиа-объект
            else if (messageOrMedia.className && messageOrMedia.className.includes('Media')) {
                return await this.client.downloadMedia(messageOrMedia);
            }
            throw new Error(`No downloadable media found. Object type: ${messageOrMedia.className || 'unknown'}`);
        } catch (err) {
            console.error('Error downloading media:', err);
            throw err;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            // GramJS provides a disconnect method
            // @ts-ignore
            if (this.client && typeof (this.client as any).disconnect === 'function') {
                // Добавляем таймаут для принудительного завершения
                await Promise.race([
                    (this.client as any).disconnect(),
                    new Promise(resolve => setTimeout(resolve, 3000)) // 3 секунды таймаут
                ]);
            }
        } catch (err) {
            console.warn('Error during Telegram client disconnect:', err);
        }
    }
}