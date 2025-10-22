import { TelegramMetadataService } from './metadata-service';
import { TelegramFileService } from './file-service';
import { serverSupabase } from '../serverSupabase';
import { TelegramService } from './client';
import { MetadataParser, BookMetadata, Message } from './parser';
import { EnhancedFileProcessingService } from './file-processing-service-enhanced';
import { FileBookMatcherService } from '../file-book-matcher-service';
import { putObject } from '../s3-service';

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
                console.log(`
📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${books.length})`);

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

            console.log(`
🏁 BookWorm завершен. Обработано: ${processedCount}, найдено совпадений: ${matchedCount}`);
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

            console.log(`
📊 Результаты загрузки:`);
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
                    console.log(`
📖 Поиск файла для: "${book.title}" автора ${book.author}`);

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
                .select('message_id')
                .not('message_id', 'is', null)
                .order('message_id', { ascending: false })
                .limit(1)
                .single();

            let lastMessageId: number | undefined = undefined;
            if (lastProcessed && lastProcessed.message_id) {
                lastMessageId = parseInt(lastProcessed.message_id, 10);
                console.log(`  📌 Последнее обработанное сообщение: ${lastMessageId}`);
            } else {
                console.log('  🆕 Синхронизация с начала, нет предыдущих обработанных сообщений');
            }

            // Получаем канал с метаданными
            const channel = await this.telegramService.getMetadataChannel();

            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                String(channel.id);

            // Получаем максимальный ID сообщения в канале
            console.log('📥 Получаем максимальный ID сообщения в канале...');
            const messages = await this.telegramService.getMessages(channelId, 1, undefined);
            let maxMessageId = 0;
            if (messages.length > 0) {
                const anyMsg = messages[0] as unknown as { [key: string]: unknown };
                maxMessageId = parseInt(String(anyMsg.id), 10);
                console.log(`  📌 Максимальный ID сообщения в канале: ${maxMessageId}`);
            }

            // Проверяем, есть ли новые сообщения для обработки
            if (lastMessageId !== undefined && maxMessageId <= lastMessageId) {
                console.log('  ℹ️  Новых сообщений для обработки нет. Пропускаем обновление.');
                return {
                    processed: 0,
                    added: 0,
                    updated: 0,
                    matched: 0,
                    message: `Синхронизация обновления завершена. Нет новых сообщений для обработки. Последнее обработанное сообщение ID: ${lastMessageId}`
                };
            }

            // Определяем диапазон для загрузки сообщений
            // В Telegram API offsetId используется для получения сообщений с ID меньше указанного
            // Поэтому для получения сообщений с ID больше последнего обработанного, 
            // нужно получить все сообщения и отфильтровать те, что имеют ID больше последнего обработанного
            console.log(`📥 Получаем сообщения из канала с ID больше последнего обработанного (${lastMessageId})...`);
            
            // Загружаем сообщения, начиная с самого последнего (с наибольшим ID)
            const newMessages = await this.telegramService.getMessages(channelId, 1000, undefined);
            
            // Фильтруем, чтобы оставить только сообщения с ID больше последнего обработанного
            const filteredMessages = newMessages.filter(msg => {
                const anyMsg = msg as unknown as { [key: string]: unknown };
                const currentMsgId = parseInt(String(anyMsg.id), 10);
                return currentMsgId > (lastMessageId || 0);
            });
            
            console.log(`✅ После фильтрации: ${filteredMessages.length} новых сообщений (из ${newMessages.length} загруженных)`);
            
            // Если после фильтрации нет новых сообщений
            if (filteredMessages.length === 0) {
                console.log('  ℹ️  Нет новых сообщений для обработки. Завершаем синхронизацию.');
                return {
                    processed: 0,
                    added: 0,
                    updated: 0,
                    matched: 0,
                    message: `Синхронизация обновления завершена. Нет новых сообщений для обработки после фильтрации. Последнее обработанное сообщение ID: ${lastMessageId}`
                };
            }
            


            // Импортируем новые сообщения как метаданные книг
            console.log('💾 Импортируем новые сообщения как метаданные книг...');
            
            // Подготовим метаданные из новых сообщений
            const metadataList: BookMetadata[] = [];
            
            for (const msg of filteredMessages) {
                const anyMsg = msg as unknown as { [key: string]: unknown };
                console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);

                // Пропускаем сообщения без текста
                if (!(msg as { text?: string }).text) {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`);
                    
                    // Проверяем, не отмечено ли уже сообщение как обработанное
                    const { data: processedCheck, error: checkError } = await serverSupabase
                        .from('telegram_processed_messages')
                        .select('message_id')
                        .eq('message_id', String(anyMsg.id));
                    
                    if (checkError) {
                        console.warn(`  ⚠️ Ошибка при проверке статуса обработки сообщения ${anyMsg.id}:`, checkError);
                    }
                    
                    // Добавляем запись в telegram_processed_messages, только если её ещё нет
                    if (!processedCheck || processedCheck.length === 0) {
                        const { error: insertError } = await serverSupabase
                            .from('telegram_processed_messages')
                            .insert({
                                message_id: String(anyMsg.id),
                                channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                                processed_at: new Date().toISOString()
                            });
                        
                        if (insertError) {
                            console.warn(`  ⚠️ Ошибка при добавлении в telegram_processed_messages для сообщения ${anyMsg.id}:`, insertError);
                        }
                    } else {
                        // Обновляем существующую запись, если нужно обновить данные
                        const { error: updateError } = await serverSupabase
                            .from('telegram_processed_messages')
                            .update({
                                channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                                processed_at: new Date().toISOString()
                            })
                            .eq('message_id', String(anyMsg.id));
                        
                        if (updateError) {
                            console.warn(`  ⚠️ Ошибка при обновлении telegram_processed_messages для сообщения ${anyMsg.id}:`, updateError);
                        }
                    }
                    
                    continue;
                }

                // Парсим текст сообщения
                const metadata = MetadataParser.parseMessage((msg as { text: string }).text);
                // Добавляем ID сообщения в метаданные
                metadata.messageId = anyMsg.id as number;

                // Проверяем, что у книги есть название и автор
                if (!metadata.title || !metadata.author || metadata.title.trim() === '' || metadata.author.trim() === '') {
                    console.log(`  ⚠️  Пропускаем сообщение ${anyMsg.id} (отсутствует название или автор)`);
                    
                    // Проверяем, не отмечено ли уже сообщение как обработанное
                    const { data: processedCheck, error: checkError } = await serverSupabase
                        .from('telegram_processed_messages')
                        .select('message_id')
                        .eq('message_id', String(anyMsg.id));
                    
                    if (checkError) {
                        console.warn(`  ⚠️ Ошибка при проверке статуса обработки сообщения ${anyMsg.id}:`, checkError);
                    }
                    
                    // Добавляем запись в telegram_processed_messages, только если её ещё нет
                    if (!processedCheck || processedCheck.length === 0) {
                        const { error: insertError } = await serverSupabase
                            .from('telegram_processed_messages')
                            .insert({
                                message_id: String(anyMsg.id),
                                channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                                processed_at: new Date().toISOString()
                            });
                        
                        if (insertError) {
                            console.warn(`  ⚠️ Ошибка при добавлении в telegram_processed_messages для сообщения ${anyMsg.id}:`, insertError);
                        }
                    } else {
                        // Обновляем существующую запись, если нужно обновить данные
                        const { error: updateError } = await serverSupabase
                            .from('telegram_processed_messages')
                            .update({
                                channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                                processed_at: new Date().toISOString()
                            })
                            .eq('message_id', String(anyMsg.id));
                        
                        if (updateError) {
                            console.warn(`  ⚠️ Ошибка при обновлении telegram_processed_messages для сообщения ${anyMsg.id}:`, updateError);
                        }
                    }
                    
                    continue;
                }

                // Проверяем наличие книги в БД по названию и автору ПЕРЕД обработкой медиа
                let bookExists = false;
                let existingBookId = null;
                try {
                    // @ts-ignore
                    const { data: foundBooks, error: findError } = await serverSupabase
                        .from('books')
                        .select('id')
                        .eq('title', metadata.title)
                        .eq('author', metadata.author);

                    if (!findError && foundBooks && foundBooks.length > 0) {
                        bookExists = true;
                        existingBookId = (foundBooks[0] as { id: string }).id;
                        console.log(`  ℹ️ Книга "${metadata.title}" автора ${metadata.author} уже существует в БД, пропускаем`);
                    }
                } catch (checkError) {
                    console.warn(`  ⚠️ Ошибка при проверке существования книги:`, checkError);
                }

                // Пропускаем сообщение, если книга уже существует
                if (bookExists) {
                    // Проверяем, не отмечено ли уже сообщение как обработанное
                    const { data: processedCheck, error: checkError } = await serverSupabase
                        .from('telegram_processed_messages')
                        .select('message_id')
                        .eq('message_id', String(anyMsg.id));
                    
                    if (checkError) {
                        console.warn(`  ⚠️ Ошибка при проверке статуса обработки сообщения ${anyMsg.id}:`, checkError);
                    }
                    
                    // Добавляем запись в telegram_processed_messages, только если её ещё нет
                    if (!processedCheck || processedCheck.length === 0) {
                        const { error: insertError } = await serverSupabase
                            .from('telegram_processed_messages')
                            .insert({
                                message_id: String(anyMsg.id),
                                channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                                book_id: existingBookId,
                                processed_at: new Date().toISOString()
                            });
                        
                        if (insertError) {
                            console.warn(`  ⚠️ Ошибка при добавлении в telegram_processed_messages для сообщения ${anyMsg.id}:`, insertError);
                        }
                    } else {
                        // Обновляем существующую запись, если нужно обновить данные
                        const { error: updateError } = await serverSupabase
                            .from('telegram_processed_messages')
                            .update({
                                channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                                book_id: existingBookId,
                                processed_at: new Date().toISOString()
                            })
                            .eq('message_id', String(anyMsg.id));
                        
                        if (updateError) {
                            console.warn(`  ⚠️ Ошибка при обновлении telegram_processed_messages для сообщения ${anyMsg.id}:`, updateError);
                        }
                    }
                    
                    continue;
                }

                // Если мы дошли до этой точки, это потенциальная новая книга
                // Извлекаем URL обложек из медиа-файлов сообщения
                const coverUrls: string[] = [];

                // Проверяем наличие медиа в сообщении
                if (anyMsg.media) {
                    console.log(`  📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`);
                    
                    // Функция для повторных попыток загрузки с увеличенным таймаутом
                    const downloadWithRetry = async (media: unknown, maxRetries = 3) => {
                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            try {
                                console.log(`    → Попытка загрузки ${attempt}/${maxRetries}...`);
                                if (!this.telegramService) {
                                    throw new Error('Telegram client not initialized');
                                }
                                const result = await Promise.race([
                                    this.telegramService.downloadMedia(media),
                                    new Promise<never>((_, reject) => 
                                        setTimeout(() => reject(new Error(`Timeout: Downloading media took too long (attempt ${attempt}/${maxRetries})`)), 60000)) // Увеличиваем до 60 секунд
                                ]);
                                return result;
                            } catch (err: unknown) {
                                console.warn(`    ⚠️ Попытка ${attempt} не удалась:`, err instanceof Error ? err.message : 'Unknown error');
                                if (attempt === maxRetries) {
                                    throw err; // Если все попытки неудачны, выбрасываем ошибку
                                }
                                // Ждем перед следующей попыткой
                                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                            }
                        }
                    };
                    
                    // Если это веб-превью (MessageMediaWebPage) - основной случай для обложек
                    if ((anyMsg.media as { className: string }).className === 'MessageMediaWebPage' && (anyMsg.media as { webpage?: { photo?: unknown } }).webpage?.photo) {
                        console.log(`  → Веб-превью с фото`);
                        try {
                            console.log(`  → Скачиваем фото из веб-превью...`);
                            const result = await downloadWithRetry((anyMsg.media as { webpage: { photo: unknown } }).webpage.photo);
                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
                                if (!coversBucket) {
                                  throw new Error('S3_COVERS_BUCKET_NAME environment variable is not set.');
                                }
                                await putObject(photoKey, Buffer.from(photoBuffer), coversBucket);
                                const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err: unknown) {
                            console.error(`  ❌ Ошибка загрузки обложки из веб-превью:`, err instanceof Error ? err.message : 'Unknown error');
                        }
                    }
                    // Если это одно фото (MessageMediaPhoto)
                    else if ((anyMsg.media as { photo?: unknown }).photo) {
                        console.log(`  → Одиночное фото`);
                        try {
                            console.log(`  → Скачиваем фото...`);
                            const result = await downloadWithRetry(msg);
                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
                                if (!coversBucket) {
                                  throw new Error('S3_COVERS_BUCKET_NAME environment variable is not set.');
                                }
                                await putObject(photoKey, Buffer.from(photoBuffer), coversBucket);
                                const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`  ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err: unknown) {
                            console.error(`  ❌ Ошибка загрузки обложки:`, err instanceof Error ? err.message : 'Unknown error');
                        }
                    }
                    // Если это документ с изображением
                    else if ((anyMsg.media as { document?: unknown }).document) {
                        const mimeType = (anyMsg.media as { document: { mimeType?: string } }).document.mimeType;
                        if (mimeType && mimeType.startsWith('image/')) {
                            console.log(`  → Одиночное изображение (документ: ${mimeType})`);
                            try {
                                console.log(`  → Скачиваем изображение...`);
                                const result = await downloadWithRetry(msg);
                                const photoBuffer = result instanceof Buffer ? result : null;
                                if (photoBuffer) {
                                    const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                    console.log(`  → Загружаем в Storage: covers/${photoKey}`);
                                    const coversBucket = process.env.S3_COVERS_BUCKET_NAME;
                                    if (!coversBucket) {
                                      throw new Error('S3_COVERS_BUCKET_NAME environment variable is not set.');
                                    }
                                    await putObject(photoKey, Buffer.from(photoBuffer), coversBucket);
                                    const photoUrl = `https://${coversBucket}.s3.cloud.ru/${photoKey}`;
                                    coverUrls.push(photoUrl);
                                    console.log(`  ✅ Обложка загружена: ${photoUrl}`);
                                } else {
                                    console.warn(`  ⚠️ Не удалось скачать изображение (пустой буфер)`);
                                }
                            } catch (err: unknown) {
                                console.error(`  ❌ Ошибка загрузки обложки:`, err instanceof Error ? err.message : 'Unknown error');
                            }
                        }
                    }
                }

                // Добавляем метаданные в список
                metadataList.push({
                    ...metadata,
                    coverUrls: coverUrls.length > 0 ? coverUrls : metadata.coverUrls || []
                });
                
                // Проверяем, не отмечено ли уже сообщение как обработанное
                const { data: processedCheck, error: checkError } = await serverSupabase
                    .from('telegram_processed_messages')
                    .select('message_id')
                    .eq('message_id', String(anyMsg.id));
                
                if (checkError) {
                    console.warn(`  ⚠️ Ошибка при проверке статуса обработки сообщения ${anyMsg.id}:`, checkError);
                }
                
                // Добавляем запись в telegram_processed_messages, только если её ещё нет
                if (!processedCheck || processedCheck.length === 0) {
                    const { error: insertError } = await serverSupabase
                        .from('telegram_processed_messages')
                        .insert({
                            message_id: String(anyMsg.id),
                            channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                            processed_at: new Date().toISOString()
                        });
                    
                    if (insertError) {
                        console.warn(`  ⚠️ Ошибка при добавлении в telegram_processed_messages для сообщения ${anyMsg.id}:`, insertError);
                    }
                } else {
                    // Обновляем существующую запись, если нужно обновить данные
                    const { error: updateError } = await serverSupabase
                        .from('telegram_processed_messages')
                        .update({
                            channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '', // Используем пустую строку вместо null
                            processed_at: new Date().toISOString()
                        })
                        .eq('message_id', String(anyMsg.id));
                    
                    if (updateError) {
                        console.warn(`  ⚠️ Ошибка при обновлении telegram_processed_messages для сообщения ${anyMsg.id}:`, updateError);
                    }
                }
            }

            console.log(`📊 Всего подготовлено метаданных для импорта: ${metadataList.length}`);
            
            // Импортируем все метаданные с дедупликацией
            console.log('💾 Импортируем метаданные с дедупликацией...');
            const resultImport = await this.metadataService.importMetadataWithDeduplication(metadataList);
            
            console.log('✅ Импорт новых метаданных завершен');

            // 3. Загружаем все сообщения из канала с файлами (все 4249 батчами по 1000)
            console.log('📥 Загрузка всех файлов из Telegram...');
            const allFilesToProcess = [];
            let offsetIdFiles: number | undefined = undefined; // Для файлов начинаем с начала, если не указано иное
            let hasMoreFiles = true;
            let fileBatchIndex = 0;
            
            while (hasMoreFiles) {
                fileBatchIndex++;
                console.log(`📥 Получаем батч файлов ${fileBatchIndex} из Telegram (лимит: 1000)...`);
                const filesBatch = await this.fileService.getFilesToProcess(1000, offsetIdFiles);
                
                if (filesBatch.length === 0) {
                    console.log('  📌 Больше нет файлов для загрузки');
                    break;
                }
                
                console.log(`  ✅ Получено ${filesBatch.length} файлов в батче ${fileBatchIndex}`);
                allFilesToProcess.push(...filesBatch);
                
                // Устанавливаем offsetIdFiles для следующего батча
                if (filesBatch.length < 1000) {
                    hasMoreFiles = false;
                } else {
                    // Берем минимальный ID из текущего батча для следующей итерации
                    const messageIds = filesBatch
                        .map(item => parseInt(String(item.messageId), 10))
                        .filter(id => !isNaN(id) && id > 0);
                    
                    if (messageIds.length > 0) {
                        offsetIdFiles = Math.min(...messageIds) - 1;
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
                return { processed: resultImport.processed, added: resultImport.added, updated: resultImport.updated, matched: 0, message: `Update sync completed. Processed ${resultImport.processed} books, added ${resultImport.added}, updated ${resultImport.updated}, no files matched.` };
            }

            console.log(`✅ Найдено ${booksWithoutFiles.length} книг без файлов для сопоставления`);

            // Для каждой книги без файла ищем соответствующий файл
            let processedCount = 0;
            let matchedCount = 0;

            for (const book of booksWithoutFiles) {
                processedCount++;
                console.log(`
📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${booksWithoutFiles.length})`);

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

            console.log(`
🏁 Синхронизация обновления завершена.`);
            
            return {
                processed: resultImport.processed,
                added: resultImport.added,
                updated: resultImport.updated,
                matched: matchedCount,
                lastProcessedMessageId: lastMessageId,
                message: `Update sync completed. Processed ${resultImport.processed} books, added ${resultImport.added}, updated ${resultImport.updated}, matched ${matchedCount} files. Started from message ID: ${lastMessageId || 'beginning'}`
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

            // 1. Индексируем все сообщения из канала с метаданными для полной проверки
            console.log('📥 Индексация всех сообщений из канала с метаданными...');
            const indexResult = await this.metadataService.indexAllMessages(10000); // Увеличиваем размер пакета для более эффективной загрузки
            
            // 2. Загружаем все сообщения из канала с файлами (все 4249 батчами по 1000)
            console.log('📥 Загрузка всех файлов из Telegram...');
            const allFilesToProcess = [];
            let offsetIdFiles: number | undefined = undefined;
            let hasMoreFiles = true;
            let fileBatchIndex = 0;
            
            while (hasMoreFiles) {
                fileBatchIndex++;
                console.log(`📥 Получаем батч файлов ${fileBatchIndex} из Telegram (лимит: 1000)...`);
                const filesBatch = await this.fileService.getFilesToProcess(1000, offsetIdFiles);
                
                if (filesBatch.length === 0) {
                    console.log('  📌 Больше нет файлов для загрузки');
                    break;
                }
                
                console.log(`  ✅ Получено ${filesBatch.length} файлов в батче ${fileBatchIndex}`);
                allFilesToProcess.push(...filesBatch);
                
                // Устанавливаем offsetIdFiles для следующего батча
                if (filesBatch.length < 1000) {
                    hasMoreFiles = false;
                } else {
                    // Берем минимальный ID из текущего батча для следующей итерации
                    const messageIds = filesBatch
                        .map(item => parseInt(String(item.messageId), 10))
                        .filter(id => !isNaN(id) && id > 0);
                    
                    if (messageIds.length > 0) {
                        offsetIdFiles = Math.min(...messageIds) - 1;
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
                return { processed: indexResult.indexed, added: 0, updated: 0, matched: 0, message: `Full sync completed. Indexed ${indexResult.indexed} messages, no books without files found for file matching.` };
            }

            console.log(`✅ Найдено ${booksWithoutFiles.length} книг без файлов для сопоставления`);

            // Для каждой книги без файла ищем соответствующий файл
            let processedCount = 0;
            let matchedCount = 0;

            for (const book of booksWithoutFiles) {
                processedCount++;
                console.log(`
📖 Обработка книги: "${book.title}" автора ${book.author} (${processedCount}/${booksWithoutFiles.length})`);

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

            console.log(`
🏁 Полная синхронизация завершена.`);
            
            return {
                processed: indexResult.indexed,
                added: 0, // В режиме full мы не добавляем книги, а индексируем сообщения
                updated: 0, // В режиме full мы не обновляем книги, а индексируем сообщения
                matched: matchedCount,
                message: `Full sync completed. Indexed ${indexResult.indexed} messages, matched ${matchedCount} files.`
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