import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';

export class TelegramService {
    private client: TelegramClient;
    private static instance: TelegramService;

    private constructor() {
        const apiId = process.env.TELEGRAM_API_ID;
        const apiHash = process.env.TELEGRAM_API_HASH;
        const sessionString = process.env.TELEGRAM_SESSION;

        if (!apiId || !apiHash || !sessionString) {
            throw new Error('TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION must be set in environment variables');
        }

        const session = new StringSession(sessionString);
        this.client = new TelegramClient(session, parseInt(apiId), apiHash, {
            connectionRetries: 5,
        });
    }

    public static async getInstance(): Promise<TelegramService> {
        if (!TelegramService.instance) {
            TelegramService.instance = new TelegramService();
            // Connect the client
            await TelegramService.instance.client.connect();
        }
        return TelegramService.instance;
    }

    public async getMetadataChannel() {
        const channelUrl = process.env.TELEGRAM_METADATA_CHANNEL;
        if (!channelUrl) {
            throw new Error('TELEGRAM_METADATA_CHANNEL must be set');
        }

        try {
            // Extract channel identifier from URL
            let channelIdentifier = channelUrl;
            if (channelUrl.startsWith('http')) {
                const url = new URL(channelUrl);
                if (url.pathname.startsWith('/+')) {
                    // This is an invite link, extract the hash part
                    channelIdentifier = url.pathname.substring(2); // Remove the leading '/+'
                } else {
                    // This is a regular channel link, extract the username
                    channelIdentifier = url.pathname.substring(1); // Remove the leading '/'
                }
            }
            
            const entity = await this.client.getEntity(channelIdentifier);
            return entity;
        } catch (error) {
            console.error('Error getting metadata channel:', error);
            throw error;
        }
    }

    public async getFilesChannel() {
        const channelUrl = process.env.TELEGRAM_FILES_CHANNEL;
        if (!channelUrl) {
            throw new Error('TELEGRAM_FILES_CHANNEL must be set');
        }

        try {
            // Extract channel identifier from URL
            let channelIdentifier = channelUrl;
            if (channelUrl.startsWith('http')) {
                const url = new URL(channelUrl);
                if (url.pathname.startsWith('/+')) {
                    // This is an invite link, extract the hash part
                    channelIdentifier = url.pathname.substring(2); // Remove the leading '/+'
                } else {
                    // This is a regular channel link, extract the username
                    channelIdentifier = url.pathname.substring(1); // Remove the leading '/'
                }
            }
            
            const entity = await this.client.getEntity(channelIdentifier);
            return entity;
        } catch (error) {
            console.error('Error getting files channel:', error);
            throw error;
        }
    }

    public async getMessages(chatId: number | string, limit: number = 10): Promise<unknown> {
        try {
            const messages = await this.client.getMessages(chatId, { limit });
            return messages;
        } catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    }

    public async downloadFile(fileId: string): Promise<Buffer> {
        try {
            // This is a placeholder - we'll need to implement proper file downloading
            throw new Error('downloadFile not implemented for session-based client');
        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    // Added methods for sync.ts
    public async downloadMedia(message: unknown): Promise<Buffer> {
        try {
            if (!this.client) {
                throw new Error('Telegram client not initialized');
            }
            
            // Download media from the message
            // We need to cast to any to avoid type issues with the Telegram library
            const buffer = await this.client.downloadMedia(message as any, {});
            
            if (!buffer) {
                throw new Error('Failed to download media');
            }
            
            // Convert to Buffer if it's not already
            if (Buffer.isBuffer(buffer)) {
                return buffer;
            } else {
                // For other types, we assume it's a Uint8Array or similar
                return Buffer.from(buffer as unknown as Uint8Array);
            }
        } catch (error) {
            console.error('Error downloading media:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            if (this.client && this.client.connected) {
                await this.client.disconnect();
            }
        } catch (error) {
            console.error('Error disconnecting Telegram client:', error);
        }
    }
}