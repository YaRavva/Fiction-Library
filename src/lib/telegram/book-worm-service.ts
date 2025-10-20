import { TelegramMetadataService } from './metadata-service';
import { TelegramFileService } from './file-service';
import { serverSupabase } from '../serverSupabase';
import { TelegramService } from './client';
import { MetadataParser, BookMetadata } from './parser';
import { EnhancedFileProcessingService } from './file-processing-service-enhanced';
import { FileBookMatcherService } from '../file-book-matcher-service';

interface Book {
    id: string;
    title: string;
    author: string;
    telegram_post_id: number | null;
    file_url?: string | null;
    telegram_file_id?: string | null;
}

export class BookWormService {
    private static instance: BookWormService;
    private telegramService: TelegramService | null = null;
    private metadataService: TelegramMetadataService | null = null;
    private fileService: TelegramFileService | null = null;
    private enhancedFileService: EnhancedFileProcessingService | null = null;

    private constructor() {}

    public static async getInstance(): Promise<BookWormService> {
        if (!BookWormService.instance) {
            BookWormService.instance = new BookWormService();
            await BookWormService.instance.initialize();
        }
        return BookWormService.instance;
    }

    private async initialize() {
        this.telegramService = await TelegramService.getInstance();
        this.metadataService = await TelegramMetadataService.getInstance();
        this.fileService = await TelegramFileService.getInstance();
        this.enhancedFileService = await EnhancedFileProcessingService.getInstance();
    }

    /**
     * Запускает процесс BookWorm для обработки новых сообщений
     */
    public async startBookWorm(): Promise<void> {
        console.log('🚀 Запуск BookWorm сервиса...');
        try {
            // Загружаем файлы для сопоставления
            console.log('📥 Загрузка файлов из Telegram...');
            const allFilesToProcess = await this.fileService!.getFilesToProcess(2000); // Загружаем 2000 файлов
            console.log(`📊 Загружено ${allFilesToProcess.length} файлов для сопоставления`);

            // Получаем все книги, которые уже есть в базе данных
            console.log('📚 Загрузка книг из базы данных...');
            const { data: books, error: booksError } = await serverSupabase
                .from('books')
                .select('id, title, author, telegram_post_id, file_url, telegram_file_id')
                .not('title', 'is', null)
                .not('author', 'is', null);

            if (booksError) {
                throw new Error(`Ошибка при загрузке книг: ${booksError.message}`);
            }

            if (!books || books.length === 0) {
                console.log('⚠️  В базе данных нет книг для сопоставления');
                return;
            }

            console.log(`✅ Загружено ${books.length} книг для сопоставления`);

            // Для каждой книги ищем соответствующий файл
            let processedCount = 0;
            let matchedCount = 0;

            for (const book of books) {
                processedCount++;
                console.log(`\n📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${books.length})`);

                // Проверяем, есть ли уже файл для этой книги
                if (book.file_url || book.telegram_file_id) {
                    console.log(`  ✅ У книги уже есть файл, пропускаем`);
                    continue;
                }

                // Ищем соответствующий файл для книги
                const matchingFile = await this.findMatchingFile(book, allFilesToProcess);
                
                if (matchingFile) {
                    console.log(`    📨 Найден соответствующий файл: ${matchingFile.filename}`);
                    console.log(`    📨 Message ID файла: ${matchingFile.messageId}`);
                    
                    try {
                        // Обрабатываем найденный файл
                        const result = await this.enhancedFileService!.processSingleFileById(parseInt(matchingFile.messageId as string, 10));
                        console.log(`    ✅ Файл успешно обработан и привязан к книге`);
                        matchedCount++;
                    } catch (processError) {
                        console.error(`    ❌ Ошибка обработки файла:`, processError);
                    }
                } else {
                    console.log(`  ⚠️  Соответствующий файл не найден`);
                }
            }

            console.log(`\n🏁 BookWorm завершен. Обработано: ${processedCount}, найдено совпадений: ${matchedCount}`);
        } catch (error) {
            console.error('❌ Ошибка в BookWorm сервисе:', error);
            throw error;
        }
    }

    /**
     * Находит соответствующий файл для книги с использованием универсального алгоритма релевантного поиска
     */
    private async findMatchingFile(book: Book, files: any[]): Promise<any | null> {
        // Проверяем, что у книги есть название и автор
        if (!book.title || !book.author || book.title.trim() === '' || book.author.trim() === '') {
            console.log(`    ️  Книга не имеет названия или автора, пропускаем`);
            return null;
        }

        console.log(`    🔍 Поиск файла для книги: "${book.title}" автора ${book.author}`);

        // Преобразуем файлы для сопоставления
        const filesForMatching = files.map((file: any) => ({
            message_id: file.messageId || file.message_id || 0,
            file_name: file.filename || '',
            mime_type: file.mime_type || 'unknown',
            file_size: file.file_size || file.size || undefined
        }));

        // Используем универсальный сервис для сопоставления
        const matches = FileBookMatcherService.findBestMatchesForBook(
            { id: book.id, title: book.title, author: book.author }, 
            filesForMatching
        );

        if (matches.length > 0) {
            // Берем лучшее совпадение (оно уже отсортировано по убыванию релевантности)
            const bestMatch = matches[0];
            
            // Найдем соответствующий файл из исходного списка
            const sourceFile = files.find((file: any) => 
                (file.messageId && file.messageId === bestMatch.file.message_id) ||
                (file.message_id && file.message_id === bestMatch.file.message_id)
            );
            
            if (sourceFile && bestMatch.score >= 65) { // Используем тот же порог, что и в универсальном сервисе
                console.log(`    ✅ Найдено совпадение с рейтингом ${bestMatch.score}: ${sourceFile.filename}`);
                console.log(`📊 Ранжирование совпадений:`);
                for (let i = 0; i < Math.min(3, matches.length); i++) {
                    const match = matches[i];
                    const matchSourceFile = files.find((file: any) => 
                        (file.messageId && file.messageId === match.file.message_id) ||
                        (file.message_id && file.message_id === match.file.message_id)
                    );
                    if (matchSourceFile) {
                        console.log(`    ${i + 1}. "${book.title}" автора ${book.author} (счет: ${match.score})`);
                    }
                }
                
                return sourceFile;
            } else if (sourceFile) {
                console.log(`    ⚠️  Найдено совпадение, но оценка ниже порога (${bestMatch.score} < 65): ${sourceFile.filename}`);
            }
        }

        console.log(`    ⚠️  Совпадения не найдены или совпадение недостаточно точное`);
        return null;
    }

    /**
     * Обрабатывает пакет метаданных
     */
    private async processMetadataBatch(messages: unknown[]): Promise<{
        processed: number;
        added: number;
        updated: number;
        errors: number;
    }> {
        // Метод оставлен без изменений
        console.log('Processing metadata batch...');
        return {
            processed: 0,
            added: 0,
            updated: 0,
            errors: 0
        };
    }

    /**
     * Загружает метаданные из Telegram канала
     */
    /**
     * Загружает метаданные из Telegram канала
     * @param fullSync Если true, выполняет полную синхронизацию без ограничений
     */
    public async loadMetadataFromTelegram(fullSync: boolean = false): Promise<void> {
        console.log('📥 Загрузка метаданных из Telegram...');
        try {
            if (!this.telegramService || !this.metadataService) {
                throw new Error('TelegramService или MetadataService не инициализированы');
            }

            // Получаем канал с метаданными
            const channel = await this.telegramService.getMetadataChannel();
            console.log(`✅ Подключено к каналу: ${channel.title || channel.username}`);

            // Инициализируем загрузку метаданных
            const limit = fullSync ? 5000 : 1000; // Для полной синхронизации больше лимит
            const { processed, added, updated, errors } = await this.metadataService.syncBooks(limit);

            console.log(`\n📊 Результаты загрузки:`);
            console.log(`  Обработано сообщений: ${processed}`);
            console.log(`  Добавлено книг: ${added}`);
            console.log(`  Обновлено книг: ${updated}`);
            console.log(`  Ошибок: ${errors}`);
        } catch (error) {
            console.error('❌ Ошибка при загрузке метаданных:', error);
            throw error;
        }
    }

    /**
     * Загружает файлы из Telegram и сопоставляет их с книгами
     */
    public async loadAndMatchFiles(): Promise<void> {
        console.log('📥 Загрузка и сопоставление файлов из Telegram...');
        try {
            if (!this.fileService) {
                throw new Error('FileService не инициализирован');
            }

            // Загружаем все файлы из Telegram
            console.log('📁 Получение списка файлов из Telegram...');
            const files = await this.fileService.getFilesToProcess(2000); // Загружаем 2000 файлов
            console.log(`✅ Получено ${files.length} файлов`);

            // Получаем книги без файлов
            const { data: booksWithoutFiles, error: booksError } = await serverSupabase
                .from('books')
                .select('id, title, author')
                .is('file_url', null)
                .not('title', 'is', null)
                .not('author', 'is', null);

            if (booksError) {
                throw new Error(`Ошибка при загрузке книг без файлов: ${booksError.message}`);
            }

            console.log(`📚 Найдено ${booksWithoutFiles?.length || 0} книг без файлов`);

            if (booksWithoutFiles && booksWithoutFiles.length > 0 && files.length > 0) {
                // Для каждой книги ищем соответствующий файл
                for (const book of booksWithoutFiles) {
                    console.log(`\n📖 Поиск файла для: "${book.title}" автора ${book.author}`);

                    const matchingFile = await this.findMatchingFile(book, files);
                    if (matchingFile) {
                        console.log(`  ✅ Найден файл: ${matchingFile.filename}`);
                        // Здесь можно добавить логику для загрузки и связывания файла с книгой
                    } else {
                        console.log(`  ❌ Файл не найден`);
                    }
                }
            } else {
                console.log('Нет книг без файлов или файлов для сопоставления');
            }
        } catch (error) {
            console.error('❌ Ошибка при загрузке и сопоставлении файлов:', error);
            throw error;
        }
    }

    /**
     * Запускает синхронизацию обновления книг (режим update)
     */
    public async runUpdateSync(): Promise<any> {
        console.log('🔄 Запуск синхронизации обновления книг...');
        
        try {
            // Проверяем, что сервисы инициализированы
            if (!this.fileService || !this.metadataService || !this.telegramService) {
                throw new Error('Необходимые сервисы не инициализированы. Убедитесь, что BookWormService создан через getInstance().');
            }

            // 1. Получаем ID последнего обработанного сообщения
            console.log('🔍 Получаем ID последнего обработанного сообщения...');
            const { data: lastProcessed, error: lastProcessedError } = await serverSupabase
                .from('telegram_processed_messages')
                .select('telegram_message_id')
                .not('telegram_message_id', 'is', null)
                .order('processed_at', { ascending: false })
                .limit(1)
                .single();

            let lastMessageId: number | undefined = undefined;
            if (lastProcessed && lastProcessed.telegram_message_id) {
                lastMessageId = parseInt(lastProcessed.telegram_message_id, 10);
                console.log(`  📌 Последнее обработанное сообщение: ${lastMessageId}`);
            } else {
                console.log('  🆕 Синхронизация с начала, нет предыдущих обработанных сообщений');
            }

            // 2. Загружаем все новые сообщения из канала с метаданными (с ID выше последнего обработанного)
            console.log('📥 Загрузка новых сообщений из канала с метаданными...');
            // Здесь должна быть логика загрузки метаданных
            await this.loadMetadataFromTelegram(false); // Частичная загрузка метаданных
            
            // 3. Загружаем все сообщения из канала с файлами (все 4249 батчами по 1000)
            console.log('📥 Загрузка всех файлов из Telegram...');
            const allFilesToProcess = [];
            let offsetId: number | undefined = lastMessageId;
            let hasMoreFiles = true;
            let fileBatchIndex = 0;
            
            while (hasMoreFiles) {
                fileBatchIndex++;
                console.log(`📥 Получаем батч файлов ${fileBatchIndex} из Telegram (лимит: 1000)...`);
                const filesBatch = await this.fileService.getFilesToProcess(1000, offsetId);
                
                if (filesBatch.length === 0) {
                    console.log('  📌 Больше нет файлов для загрузки');
                    break;
                }
                
                console.log(`  ✅ Получено ${filesBatch.length} файлов в батче ${fileBatchIndex}`);
                allFilesToProcess.push(...filesBatch);
                
                // Устанавливаем offsetId для следующего батча
                if (filesBatch.length < 1000) {
                    hasMoreFiles = false;
                } else {
                    // Берем минимальный ID из текущего батча для следующей итерации
                    const messageIds = filesBatch
                        .map(item => parseInt(String(item.messageId), 10))
                        .filter(id => !isNaN(id) && id > 0);
                    
                    if (messageIds.length > 0) {
                        offsetId = Math.min(...messageIds) - 1;
                    } else {
                        hasMoreFiles = false;
                    }
                }
            }
            
            console.log(`📊 Всего загружено файлов: ${allFilesToProcess.length}`);

            // 4. Находим все книги в БД без файлов и запускаем универсальный алгоритм привязки файлов
            console.log('📚 Поиск книг без файлов в базе данных...');
            const { data: booksWithoutFiles, error: booksError } = await serverSupabase
                .from('books')
                .select('id, title, author, telegram_post_id, file_url, telegram_file_id')
                .is('file_url', null) // Только книги без файлов
                .not('title', 'is', null)
                .not('author', 'is', null);

            if (booksError) {
                throw new Error(`Ошибка при загрузке книг без файлов: ${booksError.message}`);
            }

            if (!booksWithoutFiles || booksWithoutFiles.length === 0) {
                console.log('⚠️  Нет книг без файлов для сопоставления');
                return { processed: 0, matched: 0, message: 'No books without files found' };
            }

            console.log(`✅ Найдено ${booksWithoutFiles.length} книг без файлов для сопоставления`);

            // Для каждой книги без файла ищем соответствующий файл
            let processedCount = 0;
            let matchedCount = 0;

            for (const book of booksWithoutFiles) {
                processedCount++;
                console.log(`\n📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${booksWithoutFiles.length})`);

                // Ищем соответствующий файл для книги, используя универсальный алгоритм
                const matchingFile = await this.findMatchingFile(book, allFilesToProcess);
                
                if (matchingFile) {
                    console.log(`    📨 Найден соответствующий файл: ${matchingFile.filename}`);
                    console.log(`    📨 Message ID файла: ${matchingFile.messageId}`);
                    
                    try {
                        // Обрабатываем найденный файл
                        const result = await this.enhancedFileService!.processSingleFileById(parseInt(matchingFile.messageId as string, 10));
                        console.log(`    ✅ Файл успешно обработан и привязан к книге`);
                        matchedCount++;
                    } catch (processError) {
                        console.error(`    ❌ Ошибка обработки файла:`, processError);
                    }
                } else {
                    console.log(`  ⚠️  Соответствующий файл не найден`);
                }
            }

            console.log(`\n🏁 Синхронизация обновления завершена. Обработано: ${processedCount}, найдено совпадений: ${matchedCount}`);
            
            return {
                processed: processedCount,
                matched: matchedCount,
                lastProcessedMessageId: lastMessageId,
                message: `Update sync completed. Processed ${processedCount} books, matched ${matchedCount} files. Started from message ID: ${lastMessageId || 'beginning'}`
            };
        } catch (error) {
            console.error('❌ Ошибка в синхронизации обновления:', error);
            throw error;
        }
    }

    /**
     * Запускает полную синхронизацию книг (режим full)
     */
    public async runFullSync(): Promise<any> {
        console.log('🔄 Запуск полной синхронизации книг...');
        
        try {
            // Проверяем, что сервисы инициализированы
            if (!this.fileService || !this.metadataService || !this.telegramService) {
                throw new Error('Необходимые сервисы не инициализированы. Убедитесь, что BookWormService создан через getInstance().');
            }

            // 1. Загружаем все сообщения из канала с метаданными (без исключений)
            console.log('📥 Загрузка всех сообщений из канала с метаданными...');
            // Здесь должна быть логика загрузки всех метаданных
            await this.loadMetadataFromTelegram(true); // Полная загрузка метаданных
            
            // 2. Загружаем все сообщения из канала с файлами (все 4249 батчами по 1000)
            console.log('📥 Загрузка всех файлов из Telegram...');
            const allFilesToProcess = [];
            let offsetId: number | undefined = undefined;
            let hasMoreFiles = true;
            let fileBatchIndex = 0;
            
            while (hasMoreFiles) {
                fileBatchIndex++;
                console.log(`📥 Получаем батч файлов ${fileBatchIndex} из Telegram (лимит: 1000)...`);
                const filesBatch = await this.fileService.getFilesToProcess(1000, offsetId);
                
                if (filesBatch.length === 0) {
                    console.log('  📌 Больше нет файлов для загрузки');
                    break;
                }
                
                console.log(`  ✅ Получено ${filesBatch.length} файлов в батче ${fileBatchIndex}`);
                allFilesToProcess.push(...filesBatch);
                
                // Устанавливаем offsetId для следующего батча
                if (filesBatch.length < 1000) {
                    hasMoreFiles = false;
                } else {
                    // Берем минимальный ID из текущего батча для следующей итерации
                    const messageIds = filesBatch
                        .map(item => parseInt(String(item.messageId), 10))
                        .filter(id => !isNaN(id) && id > 0);
                    
                    if (messageIds.length > 0) {
                        offsetId = Math.min(...messageIds) - 1;
                    } else {
                        hasMoreFiles = false;
                    }
                }
            }
            
            console.log(`📊 Всего загружено файлов: ${allFilesToProcess.length}`);

            // 3. Находим все книги в БД без файлов и запускаем универсальный алгоритм привязки файлов
            console.log('📚 Поиск книг без файлов в базе данных...');
            const { data: booksWithoutFiles, error: booksError } = await serverSupabase
                .from('books')
                .select('id, title, author, telegram_post_id, file_url, telegram_file_id')
                .is('file_url', null) // Только книги без файлов
                .not('title', 'is', null)
                .not('author', 'is', null);

            if (booksError) {
                throw new Error(`Ошибка при загрузке книг без файлов: ${booksError.message}`);
            }

            if (!booksWithoutFiles || booksWithoutFiles.length === 0) {
                console.log('⚠️  Нет книг без файлов для сопоставления');
                return { processed: 0, matched: 0, message: 'No books without files found' };
            }

            console.log(`✅ Найдено ${booksWithoutFiles.length} книг без файлов для сопоставления`);

            // Для каждой книги без файла ищем соответствующий файл
            let processedCount = 0;
            let matchedCount = 0;

            for (const book of booksWithoutFiles) {
                processedCount++;
                console.log(`\n📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${booksWithoutFiles.length})`);

                // Ищем соответствующий файл для книги, используя универсальный алгоритм
                const matchingFile = await this.findMatchingFile(book, allFilesToProcess);
                
                if (matchingFile) {
                    console.log(`    📨 Найден соответствующий файл: ${matchingFile.filename}`);
                    console.log(`    📨 Message ID файла: ${matchingFile.messageId}`);
                    
                    try {
                        // Обрабатываем найденный файл
                        const result = await this.enhancedFileService!.processSingleFileById(parseInt(matchingFile.messageId as string, 10));
                        console.log(`    ✅ Файл успешно обработан и привязан к книге`);
                        matchedCount++;
                    } catch (processError) {
                        console.error(`    ❌ Ошибка обработки файла:`, processError);
                    }
                } else {
                    console.log(`  ⚠️  Соответствующий файл не найден`);
                }
            }

            console.log(`\n🏁 Полная синхронизация завершена. Обработано: ${processedCount}, найдено совпадений: ${matchedCount}`);
            
            return {
                processed: processedCount,
                matched: matchedCount,
                message: `Full sync completed. Processed ${processedCount} books, matched ${matchedCount} files.`
            };
        } catch (error) {
            console.error('❌ Ошибка в полной синхронизации:', error);
            throw error;
        }
    }

    public async shutdown(): Promise<void> {
        console.log('🛑 Завершение BookWorm сервиса...');
        
        if (this.telegramService) {
            await this.telegramService.disconnect();
        }
        
        console.log('✅ BookWorm сервис завершен');
    }
}