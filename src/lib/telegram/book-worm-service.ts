import { TelegramMetadataService } from './metadata-service';
import { TelegramFileService } from './file-service';
import { serverSupabase } from '../serverSupabase';
import { TelegramService } from './client';
import { uploadFileToStorage } from '../supabase';
import { MetadataParser, BookMetadata } from './parser'; // Импортируем MetadataParser и BookMetadata из parser

interface Book {
    id: string;
    title: string;
    author: string;
    telegram_post_id: string | null;
}

interface ProcessedMessage {
    message_id: string;
    processed_at: string;
}

interface SyncResult {
    metadata: {
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    };
    files: {
        processed: number;
        linked: number;
        skipped: number;
        errors: number;
    };
}

export class BookWormService {
    private metadataService: TelegramMetadataService | null = null;
    private fileService: TelegramFileService | null = null;
    private telegramClient: TelegramService | null = null;

    constructor() {}

    /**
     * Инициализирует сервисы
     */
    private async initializeServices(): Promise<void> {
        if (!this.metadataService) {
            this.metadataService = await TelegramMetadataService.getInstance();
        }
        if (!this.fileService) {
            this.fileService = await TelegramFileService.getInstance();
        }
        if (!this.telegramClient) {
            this.telegramClient = await TelegramService.getInstance();
        }
    }

    /**
     * Запускает полный цикл синхронизации (ручной режим)
     * Обрабатывает все данные из каналов метаданных и файлов
     */
    public async runFullSync(): Promise<SyncResult> {
        console.log('🐋 Запуск Книжного Червя в режиме ПОЛНОЙ СИНХРОНИЗАЦИИ...');
        
        try {
            await this.initializeServices();
            
            // Извлекаем все файлы из канала "Архив для фантастики"
            await this.extractAllFilesFromArchive();
            
            console.log('\n📚 Этап 1: Обработка всех метаданных из канала...');
            const metadataResult = await this.fullMetadataSync();
            
            console.log('\n📁 Этап 2: Привязка файлов к книгам...');
            const filesResult = await this.syncFiles();
            
            // Формируем итоговый отчет
            const result: SyncResult = {
                metadata: metadataResult,
                files: filesResult
            };
            
            console.log('\n📊 ИТОГОВЫЙ ОТЧЕТ КНИЖНОГО ЧЕРВЯ (ПОЛНАЯ СИНХРОНИЗАЦИЯ):');
            console.log('=====================================================');
            console.log(`📚 Метаданные:`);
            console.log(`   Обработано: ${metadataResult.processed}`);
            console.log(`   Добавлено: ${metadataResult.added}`);
            console.log(`   Обновлено: ${metadataResult.updated}`);
            console.log(`   Пропущено: ${metadataResult.skipped}`);
            console.log(`   Ошибок: ${metadataResult.errors}`);
            console.log(`📁 Файлы:`);
            console.log(`   Обработано: ${filesResult.processed}`);
            console.log(`   Привязано: ${filesResult.linked}`);
            console.log(`   Пропущено: ${filesResult.skipped}`);
            console.log(`   Ошибок: ${filesResult.errors}`);
            
            return result;
        } catch (error) {
            console.error('❌ Ошибка при выполнении полной синхронизации:', error);
            throw error;
        } finally {
            await this.shutdown();
        }
    }

    /**
     * Запускает режим обновления (автоматический режим)
     * Проверяет только новые сообщения в каналах и привязывает их
     */
    public async runUpdateSync(): Promise<SyncResult> {
        console.log('🐋 Запуск Книжного Червя в режиме ОБНОВЛЕНИЯ...');
        
        try {
            await this.initializeServices();
            
            console.log('\n🔍 Этап 1: Проверка новых метаданных...');
            const metadataResult = await this.syncNewMetadata();
            
            console.log('\n🔍 Этап 2: Привязка новых файлов...');
            const filesResult = await this.syncFiles();
            
            // Формируем итоговый отчет
            const result: SyncResult = {
                metadata: metadataResult,
                files: filesResult
            };
            
            console.log('\n📊 ИТОГОВЫЙ ОТЧЕТ КНИЖНОГО ЧЕРВЯ (ОБНОВЛЕНИЕ):');
            console.log('==============================================');
            console.log(`📚 Метаданные:`);
            console.log(`   Обработано: ${metadataResult.processed}`);
            console.log(`   Добавлено: ${metadataResult.added}`);
            console.log(`   Обновлено: ${metadataResult.updated}`);
            console.log(`   Пропущено: ${metadataResult.skipped}`);
            console.log(`   Ошибок: ${metadataResult.errors}`);
            console.log(`📁 Файлы:`);
            console.log(`   Обработано: ${filesResult.processed}`);
            console.log(`   Привязано: ${filesResult.linked}`);
            console.log(`   Пропущено: ${filesResult.skipped}`);
            console.log(`   Ошибок: ${filesResult.errors}`);
            
            return result;
        } catch (error) {
            console.error('❌ Ошибка при выполнении обновления:', error);
            throw error;
        } finally {
            await this.shutdown();
        }
    }

    /**
     * Запускает автоматическую синхронизацию (для планировщика)
     * Проверяет, нужна ли полная синхронизация, и выбирает подходящий режим
     */
    public async runAutoSync(): Promise<SyncResult> {
        console.log('🐋 Запуск Книжного Червя в АВТОМАТИЧЕСКОМ режиме...');
        
        try {
            await this.initializeServices();
            
            // Проверяем, нужна ли полная синхронизация
            const needsFullSync = await this.checkIfFullSyncNeeded();
            
            if (needsFullSync) {
                console.log('\n🔄 Требуется полная синхронизация. Запускаем полный режим...');
                return await this.runFullSync();
            } else {
                console.log('\n🔍 Запускаем режим обновления...');
                return await this.runUpdateSync();
            }
        } catch (error) {
            console.error('❌ Ошибка при выполнении автоматической синхронизации:', error);
            throw error;
        }
    }

    /**
     * Проверяет, нужна ли полная синхронизация
     */
    private async checkIfFullSyncNeeded(): Promise<boolean> {
        try {
            // Получаем количество обработанных сообщений
            const { count, error } = await serverSupabase
                .from('telegram_processed_messages')
                .select('*', { count: 'exact', head: true });
                
            if (error) {
                console.error('  ⚠️  Ошибка при проверке необходимости полной синхронизации:', error);
                return true; // По умолчанию выполняем полную синхронизацию
            }
            
            // Если еще не было обработано ни одного сообщения, нужна полная синхронизация
            if (!count || count === 0) {
                console.log('  🆕 Первый запуск - требуется полная синхронизация');
                return true;
            }
            
            // Проверяем, есть ли пропущенные сообщения
            const hasMissingMessages = await this.checkForMissingMessages();
            if (hasMissingMessages) {
                console.log('  ⚠️  Найдены пропущенные сообщения - требуется полная синхронизация');
                return true;
            }
            
            console.log(`  ✅ Уже обработано ${count} сообщений, выполняем синхронизацию новых данных`);
            return false;
        } catch (error) {
            console.error('  ⚠️  Ошибка при проверке необходимости полной синхронизации:', error);
            return true; // По умолчанию выполняем полную синхронизацию
        }
    }

    /**
     * Проверяет наличие пропущенных сообщений в канале
     */
    private async checkForMissingMessages(): Promise<boolean> {
        try {
            if (!this.metadataService) {
                throw new Error('Metadata service not initialized');
            }
            
            console.log('  🔍 Проверка наличия пропущенных сообщений...');
            
            // Получаем все сообщения из канала
            const allMessages = await this.getAllMessagesFromChannel();
            console.log(`  📊 Всего сообщений в канале: ${allMessages.length}`);
            
            // Получаем все обработанные сообщения из БД
            const { data: processedMessages, error: processedError } = await serverSupabase
                .from('telegram_processed_messages')
                .select('message_id');
                
            if (processedError) {
                console.error('  ⚠️  Ошибка при получении обработанных сообщений:', processedError);
                return true; // Предполагаем, что есть пропущенные сообщения
            }
            
            console.log(`  📊 Обработанных сообщений в БД: ${processedMessages?.length || 0}`);
            
            // Создаем множество ID обработанных сообщений для быстрого поиска
            const processedMessageIds = new Set(
                (processedMessages || []).map((msg: any) => parseInt(msg.message_id, 10))
            );
            
            // Проверяем, есть ли непrocessed сообщения
            let missingCount = 0;
            for (const message of allMessages) {
                const messageId = parseInt(String((message as any).id), 10);
                if (!processedMessageIds.has(messageId)) {
                    missingCount++;
                }
            }
            
            console.log(`  ⚠️  Найдено пропущенных сообщений: ${missingCount}`);
            
            // Если есть пропущенные сообщения, возвращаем true
            return missingCount > 0;
        } catch (error) {
            console.error('  ⚠️  Ошибка при проверке пропущенных сообщений:', error);
            return true; // Предполагаем, что есть пропущенные сообщения
        }
    }

    /**
     * Получает все сообщения из канала с метаданными
     */
    private async getAllMessagesFromChannel(): Promise<unknown[]> {
        if (!this.metadataService || !this.telegramClient) {
            throw new Error('Services not initialized');
        }
        
        try {
            console.log('  📚 Получение всех сообщений из канала с метаданными...');
            
            // Получаем канал с метаданными
            const channel = await this.telegramClient.getMetadataChannel();
            
            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                String(channel.id);
            
            // Получаем все сообщения из канала с помощью нового метода
            const allMessages = await this.telegramClient.getAllMessages(channelId, 100);
            
            console.log(`  ✅ Всего получено сообщений: ${allMessages.length}`);
            return allMessages;
        } catch (error) {
            console.error('  ❌ Ошибка при получении всех сообщений:', error);
            throw error;
        }
    }

    /**
     * Выполняет полную синхронизацию метаданных
     */
    private async fullMetadataSync(): Promise<{
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    }> {
        console.log('  📚 Полная синхронизация метаданных...');
        
        try {
            if (!this.metadataService) {
                throw new Error('Metadata service not initialized');
            }
            
            // Получаем все сообщения из канала
            const allMessages = await this.getAllMessagesFromChannel();
            
            // Обрабатываем все сообщения через существующий метод syncBooks
            // Для этого создаем временную реализацию, которая обрабатывает все сообщения
            
            // Разбиваем сообщения на пакеты по 50 штук
            const batchSize = 50;
            let totalProcessed = 0;
            let totalAdded = 0;
            let totalUpdated = 0;
            let totalSkipped = 0;
            let totalErrors = 0;
            
            for (let i = 0; i < allMessages.length; i += batchSize) {
                const batch = allMessages.slice(i, i + batchSize);
                console.log(`  📦 Обработка пакета ${Math.floor(i / batchSize) + 1} из ${Math.ceil(allMessages.length / batchSize)}...`);
                
                // Обрабатываем пакет сообщений
                const result = await this.processMessageBatch(batch);
                
                totalProcessed += result.processed;
                totalAdded += result.added;
                totalUpdated += result.updated;
                totalSkipped += result.skipped;
                totalErrors += result.errors;
                
                console.log(`    → Обработано: ${result.processed}, Добавлено: ${result.added}, Пропущено: ${result.skipped}`);
                
                // Небольшая пауза между пакетами
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log(`  ✅ Полная синхронизация завершена. Всего обработано: ${totalProcessed}`);
            
            return {
                processed: totalProcessed,
                added: totalAdded,
                updated: totalUpdated,
                skipped: totalSkipped,
                errors: totalErrors
            };
        } catch (error) {
            console.error('  ❌ Ошибка при полной синхронизации метаданных:', error);
            return {
                processed: 0,
                added: 0,
                updated: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    /**
     * Обрабатывает пакет сообщений
     */
    private async processMessageBatch(messages: unknown[]): Promise<{
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    }> {
        try {
            if (!this.metadataService) {
                throw new Error('Metadata service not initialized');
            }
            
            // Импортируем MetadataParser для парсинга сообщений
            const { MetadataParser } = await import('../telegram/parser');
            
            // Используем существующий метод syncBooks из metadata-service, но с модификацией
            // чтобы обработать все сообщения без ограничения по offsetId
            
            // Создаем временную реализацию, которая обрабатывает переданные сообщения
            const metadataList: any[] = [];
            const details: unknown[] = [];
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg = msg as unknown as { [key: string]: unknown };
                console.log(`    📝 Обрабатываем сообщение ${anyMsg.id}...`);

                // Пропускаем сообщения без текста
                if (!(msg as { text?: string }).text) {
                    console.log(`      ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`);
                    // Добавляем запись в details о пропущенном сообщении
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'no text content'
                    });
                    continue;
                }

                // Парсим текст сообщения с помощью существующего парсера
                const metadata = MetadataParser.parseMessage((msg as { text: string }).text);
                // Добавляем ID сообщения в метаданные
                metadata.messageId = anyMsg.id as number;

                // Проверяем, что у книги есть название и автор
                if (!metadata.title || !metadata.author || metadata.title.trim() === '' || metadata.author.trim() === '') {
                    console.log(`      ⚠️  Пропускаем сообщение ${anyMsg.id} (отсутствует название или автор)`);
                    // Добавляем запись в details о пропущенном сообщении
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'missing title or author',
                        bookTitle: metadata.title || 'unknown',
                        bookAuthor: metadata.author || 'unknown'
                    });
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
                        console.log(`      ℹ️ Книга "${metadata.title}" автора ${metadata.author} уже существует в БД, пропускаем`);
                    }
                } catch (checkError) {
                    console.warn(`      ⚠️ Ошибка при проверке существования книги:`, checkError);
                }

                // Пропускаем сообщение, если книга уже существует
                if (bookExists) {
                    // Добавляем запись в details о пропущенном сообщении
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'book already exists in database',
                        bookId: existingBookId,
                        bookTitle: metadata.title,
                        bookAuthor: metadata.author
                    });
                    continue;
                }

                // Извлекаем URL обложек из медиа-файлов сообщения ТОЛЬКО если книга не существует
                const coverUrls: string[] = [];

                // Проверяем наличие медиа в сообщении ТОЛЬКО если книга не существует
                if (!bookExists && anyMsg.media) {
                    console.log(`      📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`);
                    
                    // Функция для повторных попыток загрузки с увеличенным таймаутом
                    const downloadWithRetry = async (media: unknown, maxRetries = 3) => {
                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            try {
                                console.log(`        → Попытка загрузки ${attempt}/${maxRetries}...`);
                                const result = await Promise.race([
                                    this.telegramClient!.downloadMedia(media),
                                    new Promise<never>((_, reject) => 
                                        setTimeout(() => reject(new Error(`Timeout: Downloading media took too long (attempt ${attempt}/${maxRetries})`)), 60000)) // Увеличиваем до 60 секунд
                                ]);
                                return result;
                            } catch (err: unknown) {
                                console.warn(`        ⚠️ Попытка ${attempt} не удалась:`, err instanceof Error ? err.message : 'Unknown error');
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
                        console.log(`        → Веб-превью с фото`);
                        try {
                            console.log(`        → Скачиваем фото из веб-превью...`);
                            const result = await downloadWithRetry((anyMsg.media as { webpage: { photo: unknown } }).webpage.photo);
                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`        → Загружаем в Storage: covers/${photoKey}`);
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`        ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`        ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err: unknown) {
                            console.error(`        ❌ Ошибка загрузки обложки из веб-превью:`, err instanceof Error ? err.message : 'Unknown error');
                        }
                    }
                    // Если это одно фото (MessageMediaPhoto)
                    else if ((anyMsg.media as { photo?: unknown }).photo) {
                        console.log(`        → Одиночное фото`);
                        try {
                            console.log(`        → Скачиваем фото...`);
                            const result = await downloadWithRetry(msg);

                            const photoBuffer = result instanceof Buffer ? result : null;
                            if (photoBuffer) {
                                const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                console.log(`        → Загружаем в Storage: covers/${photoKey}`);
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                coverUrls.push(photoUrl);
                                console.log(`        ✅ Обложка загружена: ${photoUrl}`);
                            } else {
                                console.warn(`        ⚠️ Не удалось скачать фото (пустой буфер)`);
                            }
                        } catch (err: unknown) {
                            console.error(`        ❌ Ошибка загрузки обложки:`, err instanceof Error ? err.message : 'Unknown error');
                        }
                    }
                    // Если это документ с изображением
                    else if ((anyMsg.media as { document?: unknown }).document) {
                        const mimeType = (anyMsg.media as { document: { mimeType?: string } }).document.mimeType;
                        if (mimeType && mimeType.startsWith('image/')) {
                            console.log(`        → Одиночное изображение (документ: ${mimeType})`);
                            try {
                                console.log(`        → Скачиваем изображение...`);
                                const result = await downloadWithRetry(msg);

                                const photoBuffer = result instanceof Buffer ? result : null;
                                if (photoBuffer) {
                                    const photoKey = `${anyMsg.id}_${Date.now()}.jpg`;
                                    console.log(`        → Загружаем в Storage: covers/${photoKey}`);
                                    await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                    const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
                                    coverUrls.push(photoUrl);
                                    console.log(`        ✅ Обложка загружена: ${photoUrl}`);
                                } else {
                                    console.warn(`        ⚠️ Не удалось скачать изображение (пустой буфер)`);
                                }
                            } catch (err: unknown) {
                                console.error(`        ❌ Ошибка загрузки обложки:`, err instanceof Error ? err.message : 'Unknown error');
                            }
                        }
                    }
                }

                // Добавляем метаданные в список
                metadataList.push({
                    ...metadata,
                    coverUrls: coverUrls.length > 0 ? coverUrls : metadata.coverUrls || []
                });
                
                // Если книга уже существует, добавляем информацию в details
                if (bookExists) {
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'book already exists',
                        bookId: existingBookId,
                        bookTitle: metadata.title,
                        bookAuthor: metadata.author
                    });
                }
            }

            console.log(`    📊 Всего подготовлено метаданных: ${metadataList.length}`);
            
            // Импортируем метаданные с дедупликацией через метод экземпляра metadataService
            console.log('    💾 Импортируем метаданные с дедупликацией...');
            const resultImport = await this.metadataService.importMetadataWithDeduplication(metadataList);
            
            // Объединяем details из обоих этапов
            const combinedDetails = [...details, ...resultImport.details];
            console.log('    ✅ Импорт метаданных завершен');
            
            // Общее количество пропущенных книг (из обоих этапов)
            const totalSkipped = resultImport.skipped + details.filter(d => (d as { status: string }).status === 'skipped').length;
            
            return {
                processed: resultImport.processed,
                added: resultImport.added,
                updated: resultImport.updated,
                skipped: totalSkipped,
                errors: resultImport.errors
            };
        } catch (error) {
            console.error('    ❌ Ошибка при обработке пакета сообщений:', error);
            return {
                processed: 0,
                added: 0,
                updated: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    /**
     * Синхронизирует только новые метаданные
     */
    private async syncNewMetadata(): Promise<{
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    }> {
        try {
            if (!this.metadataService) {
                throw new Error('Metadata service not initialized');
            }
            
            // Получаем ID последнего обработанного сообщения
            const { data: lastProcessed, error: lastProcessedError } = await serverSupabase
                .from('telegram_processed_messages')
                .select('message_id')
                .order('processed_at', { ascending: false })
                .limit(1)
                .single();

            let lastMessageId: number | undefined = undefined;
            if (!lastProcessedError && lastProcessed && (lastProcessed as { message_id?: string }).message_id) {
                lastMessageId = parseInt((lastProcessed as { message_id: string }).message_id, 10);
            }

            console.log(`  📌 Последнее обработанное сообщение: ${lastMessageId || 'не найдено'}`);
            
            // Синхронизируем новые метаданные (метод автоматически получит последнее сообщение)
            const result = await this.metadataService.syncBooks(20);
            
            return {
                processed: result.processed,
                added: result.added,
                updated: result.updated,
                skipped: result.skipped,
                errors: result.errors
            };
        } catch (error) {
            console.error('  ❌ Ошибка при синхронизации новых метаданных:', error);
            return {
                processed: 0,
                added: 0,
                updated: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    /**
     * Ищет и привязывает файлы к книгам без файлов
     */
    private async syncFiles(): Promise<{
        processed: number;
        linked: number;
        skipped: number;
        errors: number;
    }> {
        try {
            if (!this.fileService) {
                throw new Error('File service not initialized');
            }
            
            // Получаем книги без файлов
            const { data: booksWithoutFiles, error } = await serverSupabase
                .from('books')
                .select('id, title, author, telegram_post_id')
                .not('telegram_post_id', 'is', null)
                .is('telegram_file_id', null)
                .is('file_url', null); // Дополнительно проверяем, что у книги нет file_url
            
            if (error) {
                console.error('  ❌ Ошибка при получении книг без файлов:', error);
                return {
                    processed: 0,
                    linked: 0,
                    skipped: 0,
                    errors: 1
                };
            }
            
            // Фильтруем книги с пустыми названиями или авторами
            const validBooks = booksWithoutFiles?.filter(book => 
                (book as { title: string }).title && (book as { title: string }).title.trim() !== '' && 
                (book as { author: string }).author && (book as { author: string }).author.trim() !== ''
            ) || [];
            
            if (validBooks.length === 0) {
                console.log('  ✅ Все книги имеют файлы или недостаточно данных для поиска');
                return {
                    processed: 0,
                    linked: 0,
                    skipped: 0,
                    errors: 0
                };
            }
            
            console.log(`  📚 Найдено ${validBooks.length} книг без файлов (с непустыми названиями и авторами)`);
            
            // Получаем ВСЕ файлы для сопоставления (без загрузки, только имена)
            console.log(`  📥 Получаем список ВСЕХ файлов для сопоставления...`);
            // Увеличиваем лимит для получения большего количества файлов
            const filesToProcess = await this.fileService.getFilesToProcess(1000); // Получаем больше файлов
            console.log(`  ✅ Получено ${filesToProcess.length} файлов для анализа`);
            
            let processed = 0;
            let linked = 0;
            let skipped = 0;
            let errors = 0;
            
            // Для каждой книги пытаемся найти и привязать файл
            for (const book of validBooks) {
                const typedBook = book as Book;
                console.log(`\n  📖 Обработка книги: "${typedBook.title}" автора ${typedBook.author}`);
                
                try {
                    // Пытаемся найти соответствующий файл по названию и автору
                    const matchingFile = this.findMatchingFile(typedBook, filesToProcess);
                    
                    if (matchingFile) {
                        console.log(`    📨 Найден соответствующий файл: ${matchingFile.filename}`);
                        console.log(`    📨 Message ID файла: ${matchingFile.messageId}`);
                        
                        // Пытаемся обработать файл
                        console.log(`    ⬇️  Попытка обработки файла...`);
                        const result = await this.fileService!.processSingleFileById(parseInt(matchingFile.messageId as string, 10));
                        
                        processed++;
                        
                        if (result.success && !result.skipped) {
                            console.log(`    ✅ Файл успешно привязан`);
                            linked++;
                        } else if (result.skipped) {
                            console.log(`    ⚠️  Файл пропущен: ${result.reason || 'Неизвестная причина'}`);
                            skipped++;
                        } else {
                            console.log(`    ⚠️  Файл не привязан: ${result.reason || 'Неизвестная причина'}`);
                            skipped++;
                        }
                    } else {
                        console.log(`    ⚠️  Соответствующий файл не найден`);
                        skipped++;
                    }
                } catch (error) {
                    console.error(`    ❌ Ошибка при обработке книги:`, error);
                    errors++;
                }
            }
            
            return {
                processed,
                linked,
                skipped,
                errors
            };
        } catch (error) {
            console.error('  ❌ Ошибка при синхронизации файлов:', error);
            return {
                processed: 0,
                linked: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    /**
     * Находит соответствующий файл для книги
     */
    private findMatchingFile(book: Book, files: any[]): any | null {
        // Проверяем, что у книги есть название и автор
        if (!book.title || !book.author || book.title.trim() === '' || book.author.trim() === '') {
            console.log(`    ⚠️  Книга не имеет названия или автора, пропускаем`);
            return null;
        }
        
        console.log(`    🔍 Поиск файла для книги: "${book.title}" автора ${book.author}`);
        
        // Используем более точный алгоритм поиска
        let bestMatch: any | null = null;
        let bestScore = 0;
        
        for (const file of files) {
            if (!file.filename) continue;
            
            const filename = file.filename.toLowerCase();
            const bookTitle = book.title.toLowerCase();
            const bookAuthor = book.author.toLowerCase();
            
            let score = 0;
            
            // Проверяем точное совпадение названия книги (с высоким весом)
            if (filename.includes(bookTitle.replace(/\s+/g, '_'))) {
                score += 20;
            }
            
            // Проверяем точное совпадение автора (с высоким весом)
            if (filename.includes(bookAuthor.replace(/\s+/g, '_'))) {
                score += 20;
            }
            
            // Проверяем, что оба элемента (название и автор) присутствуют в имени файла
            // Это критически важно для правильного сопоставления
            const titleInFilename = filename.includes(bookTitle.replace(/\s+/g, '_'));
            const authorInFilename = filename.includes(bookAuthor.replace(/\s+/g, '_'));
            
            // Если и название, и автор присутствуют, добавляем бонус
            if (titleInFilename && authorInFilename) {
                score += 30; // Большой бонус за полное совпадение
            }
            
            // Добавляем проверку на частичное совпадение слов в названии
            // Разбиваем название книги на слова
            const bookTitleWords = bookTitle.split(/\s+/).filter(word => word.length > 2);
            let titleWordsMatchCount = 0;
            
            for (const word of bookTitleWords) {
                if (filename.includes(word)) {
                    titleWordsMatchCount++;
                }
            }
            
            // Если совпадает более 50% слов из названия, добавляем бонус
            if (bookTitleWords.length > 0 && titleWordsMatchCount / bookTitleWords.length >= 0.5) {
                score += 15;
            }
            
            // Проверяем, чтобы не было ложных совпадений
            // Например, "Мир Перекрёстка" не должен совпадать с "Исчезнувший мир"
            const falsePositiveKeywords = [
                'исчезнувш', 'умирающ', 'смерть', 'оксфордск', 'консул', 'галактическ', 
                'логосов', 'напряжен', 'двуеди', 'морск', 'славянск'
            ];
            
            const bookTitleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
                bookTitle.includes(keyword) && !filename.includes(keyword)
            );
            
            const filenameContainsFalsePositive = falsePositiveKeywords.some(keyword => 
                filename.includes(keyword) && !bookTitle.includes(keyword)
            );
            
            // Если есть ложные совпадения, уменьшаем счет
            if (bookTitleContainsFalsePositive || filenameContainsFalsePositive) {
                score -= 20;
            }
            
            // Проверяем частичное совпадение названия (более 80% символов)
            const titleMatchThreshold = Math.floor(bookTitle.length * 0.8);
            if (titleMatchThreshold > 0) {
                const partialTitle = bookTitle.substring(0, Math.min(titleMatchThreshold, bookTitle.length));
                if (filename.includes(partialTitle.replace(/\s+/g, '_'))) {
                    score += 10;
                }
            }
            
            // Проверяем частичное совпадение автора (более 80% символов)
            const authorMatchThreshold = Math.floor(bookAuthor.length * 0.8);
            if (authorMatchThreshold > 0) {
                const partialAuthor = bookAuthor.substring(0, Math.min(authorMatchThreshold, bookAuthor.length));
                if (filename.includes(partialAuthor.replace(/\s+/g, '_'))) {
                    score += 10;
                }
            }
            
            // Проверяем совпадение по поисковым терминам
            const searchTerms = [...bookTitleWords, ...bookAuthor.split(/\s+/).filter(word => word.length > 2)];
            for (const term of searchTerms) {
                if (filename.includes(term)) {
                    score += 5;
                }
            }
            
            // НОВОЕ: Проверяем включение всех слов из имени файла в название и автора книги
            // Разбиваем имя файла на слова
            const filenameWords = filename.toLowerCase().split(/[_\-\s]+/).filter((word: string) => word.length > 2);
            let allWordsInTitle = true;
            let allWordsInAuthor = true;
            let wordsFoundCount = 0;
            let titleWordsFound = 0;
            let authorWordsFound = 0;
            
            for (const word of filenameWords) {
                // Проверяем включение слова в название книги
                if (bookTitle.includes(word)) {
                    wordsFoundCount++;
                    titleWordsFound++;
                } else {
                    allWordsInTitle = false;
                }
                // Проверяем включение слова в автора книги
                if (bookAuthor.includes(word)) {
                    wordsFoundCount++;
                    authorWordsFound++;
                } else {
                    allWordsInAuthor = false;
                }
            }
            
            // Если все слова из имени файла включены в название или автора, добавляем бонус
            // Учитываем количество найденных слов
            if (allWordsInTitle || allWordsInAuthor || wordsFoundCount > 0) {
                // Бонус зависит от количества найденных слов
                const wordBonus = Math.min(30, wordsFoundCount * 5); // Максимум 30 баллов
                score += wordBonus;
                
                // Дополнительный бонус, если слова найдены и в названии, и в авторе
                if (titleWordsFound > 0 && authorWordsFound > 0) {
                    score += 10; // Дополнительный бонус
                }
            }
            
            // Если все слова включены и в название, и в автора, добавляем еще больший бонус
            if (allWordsInTitle && allWordsInAuthor) {
                score += 20; // Дополнительный бонус
            }
            
            // Если текущий файл имеет лучший счет, обновляем лучшее совпадение
            // Но только если счет достаточно высок (минимум 30 - это означает, что найдены и название, и автор)
            if (score > bestScore && score >= 30) {
                bestScore = score;
                bestMatch = file;
            }
        }
        
        if (bestMatch && bestScore >= 30) {
            console.log(`    ✅ Найдено совпадение с рейтингом ${bestScore}: ${bestMatch.filename}`);
            return bestMatch;
        }
        
        console.log(`    ⚠️  Совпадения не найдены или совпадение недостаточно точное`);
        return null;
    }

    /**
     * Извлекает все файлы из канала "Архив для фантастики" по 100 за раз
     */
    private async extractAllFilesFromArchive(): Promise<void> {
        console.log('📦 Извлечение всех файлов из канала "Архив для фантастики"...');
        
        try {
            if (!this.fileService) {
                throw new Error('File service not initialized');
            }
            
            // Получаем все файлы из канала по 100 за раз
            const batchSize = 100;
            let totalProcessed = 0;
            let hasMoreFiles = true;
            let offsetId: number | undefined = undefined;
            let batchNumber = 1;
            
            while (hasMoreFiles) {
                console.log(`📥 Обработка батча ${batchNumber} (по ${batchSize} файлов)...`);
                
                try {
                    // Получаем файлы для обработки с учетом offsetId
                    const files = await this.fileService.getFilesToProcess(batchSize, offsetId);
                    
                    if (files.length === 0) {
                        console.log('  ✅ Все файлы извлечены');
                        hasMoreFiles = false;
                        break;
                    }
                    
                    console.log(`  📊 Получено ${files.length} файлов в батче ${batchNumber}`);
                    totalProcessed += files.length;
                    
                    // Обновляем offsetId для следующей итерации
                    // Берем минимальный ID из полученных файлов
                    const fileIds = files
                        .map(file => parseInt(String((file as { messageId: string }).messageId), 10))
                        .filter(id => !isNaN(id));
                    
                    if (fileIds.length > 0) {
                        offsetId = Math.min(...fileIds) - 1; // Минимальный ID минус 1
                    } else {
                        hasMoreFiles = false;
                        break;
                    }
                    
                    console.log(`  📈 Всего обработано: ${totalProcessed} файлов`);
                    batchNumber++;
                    
                    // Небольшая пауза между батчами
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (batchError) {
                    console.error(`  ❌ Ошибка при обработке батча ${batchNumber}:`, batchError);
                    // Продолжаем обработку следующих батчей
                    batchNumber++;
                }
            }
            
            console.log(`\n🎉 Извлечение файлов завершено. Всего обработано: ${totalProcessed} файлов`);
        } catch (error) {
            console.error('❌ Ошибка при извлечении файлов из архива:', error);
            // Не прерываем выполнение основной синхронизации из-за ошибки извлечения
        }
    }

    /**
     * Корректно завершает работу сервисов
     */
    private async shutdown(): Promise<void> {
        console.log('\n🔌 Завершение работы сервисов...');
        
        try {
            if (this.fileService) {
                await this.fileService.shutdown();
            }
        } catch (error) {
            console.error('  ⚠️  Ошибка при завершении file service:', error);
        }
        
        console.log('  ✅ Книжный Червь завершил работу');
    }
}