import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import bigInt from 'big-integer';

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
                    // This is an invite link, we need to join the channel first
                    const inviteHash = url.pathname.substring(2); // Remove the leading '/+'
                    try {
                        // Try to join the channel using the invite link
                        const result = await this.client.invoke(new Api.messages.ImportChatInvite({
                            hash: inviteHash
                        }));
                        // After joining, we should be able to get the entity using the chat ID
                        // The result contains the chat information
                        if (result && 'chats' in result && result.chats.length > 0) {
                            // Use the actual chat ID instead of the invite hash
                            // Convert BigInteger to string
                            channelIdentifier = result.chats[0].id.toString();
                        } else {
                            // Fallback to using the invite hash directly
                            channelIdentifier = inviteHash;
                        }
                    } catch (joinError: any) {
                        // If user is already participant, we can try to access the channel directly
                        if (joinError && joinError.errorMessage === 'USER_ALREADY_PARTICIPANT') {
                            console.log('User is already participant, trying to access channel directly');
                            channelIdentifier = inviteHash;
                        } else {
                            console.warn('Could not join channel via invite link, trying direct access:', joinError);
                            channelIdentifier = inviteHash;
                        }
                    }
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
        // Используем прямой доступ к каналу по ID вместо invite link
        console.log('📚 Получаем доступ к каналу "Архив для фантастики" по ID...');
        const channelId = 1515159552; // ID канала "Архив для фантастики"
        
        try {
            const entity = await this.client.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
            return entity;
        } catch (error) {
            console.error('Error getting files channel by ID:', error);
            throw error;
        }
    }

    public async getMessages(chatId: any, limit: number = 10, offsetId?: number): Promise<unknown> {
        try {
            // Для получения конкретного сообщения по ID используем ids
            if (offsetId !== undefined && limit === 1) {
                // Получаем конкретное сообщение по ID
                // Используем правильный формат для InputMessage
                const messages = await this.client.getMessages(chatId, { 
                    ids: [offsetId] 
                });
                return messages;
            }
            
            // Для получения списка сообщений используем стандартные параметры
            const options: { limit: number; offsetId?: number; addOffset?: number } = { limit };
            if (offsetId !== undefined) {
                options.offsetId = offsetId;
                options.addOffset = 0; // Убедимся, что addOffset равен 0
            }
            const messages = await this.client.getMessages(chatId, options);
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

    // Addeded methods for sync.ts
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

    /**
     * Получает сущность канала по ID напрямую
     * @param channelId ID канала
     * @returns Сущность канала
     */
    public async getChannelEntityById(channelId: number): Promise<unknown> {
        try {
            const entity = await this.client.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
            return entity;
        } catch (error) {
            console.error(`Error getting channel entity by ID ${channelId}:`, error);
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