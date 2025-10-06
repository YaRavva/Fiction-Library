import { serverSupabase } from '../serverSupabase';
import { TelegramFileService } from './file-service';
import { DownloadQueue, DownloadTask } from './queue';
import { TelegramService } from './client';

/**
 * Воркер для обработки файлов из очереди загрузки
 */
export class DownloadWorker {
    private static instance: DownloadWorker;
    private fileService: TelegramFileService | null = null;
    private queue: DownloadQueue | null = null;
    private isRunning = false;
    private intervalId: NodeJS.Timeout | null = null;

    private constructor() {}

    public static async getInstance(): Promise<DownloadWorker> {
        if (!DownloadWorker.instance) {
            DownloadWorker.instance = new DownloadWorker();
            DownloadWorker.instance.fileService = await TelegramFileService.getInstance();
            DownloadWorker.instance.queue = new DownloadQueue();
        }
        return DownloadWorker.instance;
    }

    /**
     * Запускает воркер для обработки файлов из очереди
     * @param interval Интервал проверки очереди в миллисекундах (по умолчанию 30 секунд)
     */
    public async start(interval: number = 30000): Promise<void> {
        // Отключаем функционал воркера
        console.log('⚠️  Воркер загрузки файлов отключен');
        return;
        
        /*
        if (this.isRunning) {
            console.log('⚠️  Воркер уже запущен');
            return;
        }

        this.isRunning = true;
        console.log(`🚀 Запуск воркера для обработки файлов из очереди (интервал: ${interval}ms)`);

        // Немедленная обработка при запуске
        await this.processQueue();

        // Планируем регулярную обработку
        this.intervalId = setInterval(async () => {
            await this.processQueue();
        }, interval);
        */
    }

    /**
     * Останавливает воркер
     */
    public async stop(): Promise<void> {
        // Отключаем функционал остановки воркера
        console.log('⚠️  Остановка воркера загрузки файлов отключена');
        return;
        
        /*
        if (!this.isRunning) {
            console.log('⚠️  Воркер не запущен');
            return;
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        console.log('🛑 Воркер остановлен');
        */
    }

    /**
     * Обрабатывает файлы из очереди загрузки
     */
    private async processQueue(): Promise<void> {
        if (!this.fileService || !this.queue) {
            // console.error('❌ Сервис файлов или очередь не инициализированы');
            return;
        }

        try {
            // console.log('🔍 Проверка очереди загрузки файлов...');

            // Получаем следующую задачу из очереди с помощью RPC функции
            const task = await this.queue.getNextTask();

            if (!task) {
                // console.log('📭 Очередь пуста, нет задач для обработки');
                return;
            }

            // console.log(`📥 Обработка задачи ID: ${task.id}, message_id: ${task.message_id}`);

            try {
                // Получаем настоящее сообщение из Telegram перед обработкой
                const message = await this.getMessageFromTelegram(task.message_id, task.channel_id);
                
                if (!message) {
                    console.error(`❌ Не удалось получить сообщение ${task.message_id} из Telegram`);
                    await this.queue.completeTask(task.id, false, 'Не удалось получить сообщение из Telegram');
                    return;
                }

                // Обрабатываем файл
                const result = await this.processFileTask(message);
                
                // Обновляем статус задачи
                const success = result.success !== false;
                const errorMsg = success ? undefined : (result.error as string | undefined);
                await this.queue.completeTask(task.id, success, errorMsg);

                console.log(`✅ Задача ${task.id} завершена со статусом: ${success ? 'completed' : 'failed'}`);
            } catch (taskError) {
                console.error(`❌ Ошибка при обработке задачи ${task.id}:`, taskError);
                
                // Обновляем статус задачи на "ошибка"
                await this.queue.completeTask(task.id, false, taskError instanceof Error ? taskError.message : 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Ошибка при обработке очереди:', error);
        }
    }

    /**
     * Получает настоящее сообщение из Telegram по ID
     * @param messageId ID сообщения
     * @param channelId ID канала
     */
    private async getMessageFromTelegram(messageId: string, channelId: string): Promise<{[key: string]: unknown} | null> {
        try {
            console.log(`  📡 Получение сообщения ${messageId} из Telegram...`);
            
            // Получаем клиент Telegram
            const telegramClient = await TelegramService.getInstance();
            
            // Получаем сообщение
            const messages = await telegramClient.getMessages(channelId, 1, parseInt(messageId, 10)) as unknown as any[];
            
            if (messages && messages.length > 0) {
                console.log(`  ✅ Сообщение получено из Telegram`);
                return messages[0] as {[key: string]: unknown};
            } else {
                console.log(`  ⚠️ Сообщение ${messageId} не найдено в Telegram`);
                return null;
            }
        } catch (error) {
            console.error(`  ❌ Ошибка при получении сообщения ${messageId} из Telegram:`, error);
            return null;
        }
    }

    /**
     * Обрабатывает отдельную задачу загрузки файла
     * @param message Сообщение из Telegram
     */
    private async processFileTask(message: {[key: string]: unknown}): Promise<{[key: string]: unknown}> {
        if (!this.fileService) {
            throw new Error('File service not initialized');
        }

        try {
            console.log(`  📨 Обработка файла для сообщения ${message.id}...`);
            
            // Обрабатываем один файл через публичный метод
            const result = await this.fileService.processSingleFile(message);
            return result;
        } catch (error) {
            console.error(`  ❌ Ошибка при обработке задачи с сообщением ${message.id}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Добавляет задачу в очередь загрузки
     * @param messageId ID сообщения в Telegram
     * @param channelId ID канала в Telegram
     * @param priority Приоритет задачи (0 - по умолчанию)
     */
    public async addTask(messageId: string, channelId: string, priority: number = 0): Promise<void> {
        if (!this.queue) {
            throw new Error('Queue not initialized');
        }

        try {
            await this.queue.addTask({
                message_id: messageId,
                channel_id: channelId,
                priority: priority
            });

            console.log(`✅ Задача добавлена в очередь: message_id=${messageId}`);
        } catch (error) {
            console.error(`❌ Ошибка при добавлении задачи:`, error);
            throw error;
        }
    }
}