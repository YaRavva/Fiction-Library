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
            const [channelId, messageId] = fileId.split(':').map(Number);
            const channel = await this.client.getEntity(channelId);
            const message = await this.client.getMessages(channel, { ids: [messageId] });

            if (!Array.isArray(message) || !message[0]?.media) {
                throw new Error('Message or media not found');
            }

            // Скачиваем файл
            const buffer = await this.client.downloadMedia(message[0].media);

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
            if (hash) {
                // Try join by invite
                try {
                    await this.client.invoke(new (await import('telegram')).Api.messages.ImportChatInvite({ hash }));
                } catch (e) {
                    // ignore invite errors
                }
            }

            const identifier = url || hash;
            const name = (identifier as string).split('/').pop() || (identifier as string);
            return await this.client.getEntity(name);
        } catch (err) {
            console.error('Error getting files channel:', err);
            throw err;
        }
    }

    public async getMessages(entity: any, limit = 10) {
        try {
            return await this.client.getMessages(entity, { limit });
        } catch (err) {
            console.error('Error getting messages:', err);
            throw err;
        }
    }

    public async downloadMedia(message: any) {
        try {
            if (message.document || message.media) {
                return await this.client.downloadMedia(message);
            }
            throw new Error('No document/media in message');
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
                await (this.client as any).disconnect();
            }
        } catch (err) {
            console.warn('Error during Telegram client disconnect:', err);
        }
    }
}