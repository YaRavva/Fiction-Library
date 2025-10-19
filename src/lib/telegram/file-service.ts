import { FileProcessingService } from './file-processing-service';

/**
 * @deprecated Use FileProcessingService instead
 */
export class TelegramFileService {
    private static instance: TelegramFileService;

    private constructor() {}

    public static async getInstance(): Promise<TelegramFileService> {
        if (!TelegramFileService.instance) {
            TelegramFileService.instance = new TelegramFileService();
        }
        return TelegramFileService.instance;
    }

    /**
     * Скачивает и обрабатывает файлы из канала "Архив для фантастики" напрямую (без очереди)
     * @param limit Количество сообщений для обработки
     */
    public async downloadAndProcessFilesDirectly(limit: number = 10): Promise<{[key: string]: unknown}[]> {
        const service = await FileProcessingService.getInstance();
        return service.downloadAndProcessFilesDirectly(limit);
    }

    /**
     * Получает список файлов для обработки без их непосредственной обработки
     * @param limit Количество сообщений для получения
     * @param offsetId ID сообщения, с которого начинать (для пагинации)
     */
    public async getFilesToProcess(limit: number = 10, offsetId?: number): Promise<{[key: string]: unknown}[]> {
        const service = await FileProcessingService.getInstance();
        return service.getFilesToProcess(limit, offsetId);
    }

    /**
     * Обрабатывает один файл по ID сообщения
     * @param messageId ID сообщения с файлом
     */
    public async processSingleFileById(messageId: number): Promise<{[key: string]: unknown}> {
        const service = await FileProcessingService.getInstance();
        return service.processSingleFileById(messageId);
    }

    /**
     * Обрабатывает один файл напрямую с правильной логикой
     * @param message Сообщение Telegram с файлом
     */
    public async processSingleFile(message: {[key: string]: unknown}): Promise<{[key: string]: unknown}> {
        const service = await FileProcessingService.getInstance();
        return service.processSingleFile(message);
    }

    public async shutdown(): Promise<void> {
        // No-op for compatibility
    }
}