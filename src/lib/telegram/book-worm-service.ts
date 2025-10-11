import { TelegramMetadataService } from './metadata-service';
import { TelegramFileService } from './file-service';
import { serverSupabase } from '../serverSupabase';
import { TelegramService } from './client';
import { uploadFileToStorage } from '../supabase';
import { MetadataParser, BookMetadata } from './parser';

interface Book {
    id: string;
    title: string;
    author: string;
    telegram_post_id: number | null;
    file_url?: string | null;
    telegram_file_id?: string | null;
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

interface IndexResult {
    indexed: number;
    errors: number;
}

/**
 * Оптимальный сервис загрузки книг и файлов из Telegram
 *
 * Архитектура:
 * 1. Метаданные книг загружаются из публичного канала (ID сообщений = telegram_post_id)
 * 2. Файлы загружаются из приватного канала (ID сообщений = telegram_file_id)
 * 3. Связь осуществляется через релевантный поиск по названию и автору
 * 4. Поддерживает два режима: полный и обновление
 */
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
     * Запускает полный цикл синхронизации
     * Последовательность: метаданные → файлы → привязка
     */
    public async runFullSync(): Promise<SyncResult> {
        console.log('🐋 Запуск Книжного Червя в режиме ПОЛНОЙ СИНХРОНИЗАЦИИ...');

        try {
            await this.initializeServices();

            // Этап 1: Загрузка всех метаданных из публичного канала
            console.log('\n📚 Этап 1: Загрузка метаданных из публичного канала...');
            const metadataResult = await this.loadAllMetadata();

            // Этап 2: Загрузка всех файлов из приватного канала
            console.log('\n📁 Этап 2: Загрузка файлов из приватного канала...');
            const filesResult = await this.loadAllFiles();

            // Этап 3: Привязка файлов к книгам через релевантный поиск
            console.log('\n🔗 Этап 3: Привязка файлов к книгам...');
            const linkingResult = await this.linkFilesToBooks();

            // Формируем итоговый отчет
            const result: SyncResult = {
                metadata: metadataResult,
                files: {
                    processed: filesResult.processed,
                    linked: linkingResult.linked,
                    skipped: filesResult.skipped + linkingResult.skipped,
                    errors: filesResult.errors + linkingResult.errors
                }
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
            console.log(`   Привязано: ${linkingResult.linked}`);
            console.log(`   Пропущено: ${filesResult.skipped + linkingResult.skipped}`);
            console.log(`   Ошибок: ${filesResult.errors + linkingResult.errors}`);

            return result;
        } catch (error) {
            console.error('❌ Ошибка при выполнении полной синхронизации:', error);
            throw error;
        } finally {
            await this.shutdown();
        }
    }

    /**
     * Запускает режим обновления (только новые записи)
     * Проверяет только новые сообщения в каналах
     */
    public async runUpdateSync(): Promise<SyncResult> {
        console.log('🐋 Запуск Книжного Червя в режиме ОБНОВЛЕНИЯ...');

        try {
            await this.initializeServices();

            // Этап 1: Загрузка новых метаданных
            console.log('\n🔍 Этап 1: Загрузка новых метаданных...');
            const metadataResult = await this.loadNewMetadata();

            // Этап 2: Загрузка новых файлов
            console.log('\n🔍 Этап 2: Загрузка новых файлов...');
            const filesResult = await this.loadNewFiles();

            // Этап 3: Привязка новых файлов к книгам
            console.log('\n🔗 Этап 3: Привязка новых файлов к книгам...');
            const linkingResult = await this.linkFilesToBooks();

            // Формируем итоговый отчет
            const result: SyncResult = {
                metadata: metadataResult,
                files: {
                    processed: filesResult.processed,
                    linked: linkingResult.linked,
                    skipped: filesResult.skipped + linkingResult.skipped,
                    errors: filesResult.errors + linkingResult.errors
                }
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
            console.log(`   Привязано: ${linkingResult.linked}`);
            console.log(`   Пропущено: ${filesResult.skipped + linkingResult.skipped}`);
            console.log(`   Ошибок: ${filesResult.errors + linkingResult.errors}`);

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
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
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
     * Загружает все метаданные из публичного канала
     */
    private async loadAllMetadata(): Promise<{
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    }> {
        console.log('  📚 Загрузка всех метаданных из публичного канала...');

        try {
            if (!this.metadataService) {
                throw new Error('Metadata service not initialized');
            }

            // Получаем все сообщения из публичного канала метаданных
            const allMessages = await this.getAllMessagesFromMetadataChannel();

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
                const result = await this.processMetadataBatch(batch);

                totalProcessed += result.processed;
                totalAdded += result.added;
                totalUpdated += result.updated;
                totalSkipped += result.skipped;
                totalErrors += result.errors;

                console.log(`    → Обработано: ${result.processed}, Добавлено: ${result.added}, Обновлено: ${result.updated}, Пропущено: ${result.skipped}, Ошибок: ${result.errors}`);

                // Небольшая пауза между пакетами
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log(`  ✅ Загрузка метаданных завершена. Всего обработано: ${totalProcessed}`);

            return {
                processed: totalProcessed,
                added: totalAdded,
                updated: totalUpdated,
                skipped: totalSkipped,
                errors: totalErrors
            };
        } catch (error) {
            console.error('  ❌ Ошибка при загрузке метаданных:', error);
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
     * Загружает только новые метаданные (режим обновления)
     */
    private async loadNewMetadata(): Promise<{
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

            console.log('  📚 Загрузка новых метаданных...');

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

            // Синхронизируем новые метаданные
            const result = await this.metadataService.syncBooks(20);

            return {
                processed: result.processed,
                added: result.added,
                updated: result.updated,
                skipped: result.skipped,
                errors: result.errors
            };
        } catch (error) {
            console.error('  ❌ Ошибка при загрузке новых метаданных:', error);
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
     * Загружает все файлы из приватного канала
     */
    private async loadAllFiles(): Promise<{
        processed: number;
        linked: number;
        skipped: number;
        errors: number;
    }> {
        console.log('  📁 Загрузка всех файлов из приватного канала...');

        try {
            if (!this.fileService) {
                throw new Error('File service not initialized');
            }

            // Получаем все файлы из приватного канала
            const batchSize = 100;
            let totalProcessed = 0;
            const totalSkipped = 0;
            let totalErrors = 0;
            let hasMoreFiles = true;
            let offsetId: number | undefined = undefined;
            let batchNumber = 1;

            while (hasMoreFiles) {
                console.log(`📥 Обработка батча ${batchNumber} (по ${batchSize} файлов)...`);

                try {
                    // Получаем файлы для обработки с учетом offsetId
                    const files = await this.fileService.getFilesToProcess(batchSize, offsetId);

                    if (files.length === 0) {
                        console.log('  ✅ Все файлы загружены');
                        hasMoreFiles = false;
                        break;
                    }

                    console.log(`  📊 Получено ${files.length} файлов в батче ${batchNumber}`);
                    totalProcessed += files.length;

                    // Обновляем offsetId для следующей итерации
                    const fileIds = files
                        .map(file => parseInt(String((file as { messageId: string }).messageId), 10))
                        .filter(id => !isNaN(id));

                    if (fileIds.length > 0) {
                        offsetId = Math.min(...fileIds) - 1;
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
                    totalErrors++;
                    batchNumber++;
                }
            }

            console.log(`\n🎉 Загрузка файлов завершена. Всего обработано: ${totalProcessed} файлов`);

            return {
                processed: totalProcessed,
                linked: 0, // Файлы загружены, но еще не привязаны к книгам
                skipped: totalSkipped,
                errors: totalErrors
            };
        } catch (error) {
            console.error('❌ Ошибка при загрузке файлов:', error);
            return {
                processed: 0,
                linked: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    /**
     * Загружает только новые файлы (режим обновления)
     */
    private async loadNewFiles(): Promise<{
        processed: number;
        linked: number;
        skipped: number;
        errors: number;
    }> {
        try {
            if (!this.fileService) {
                throw new Error('File service not initialized');
            }

            console.log('  📁 Загрузка новых файлов...');

            // Получаем файлы, загруженные после последней обработки
            const filesToProcess = await this.fileService.getFilesToProcess(100);

            console.log(`  ✅ Получено ${filesToProcess.length} файлов для анализа`);

            return {
                processed: filesToProcess.length,
                linked: 0,
                skipped: 0,
                errors: 0
            };
        } catch (error) {
            console.error('  ❌ Ошибка при загрузке новых файлов:', error);
            return {
                processed: 0,
                linked: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    /**
     * Привязывает файлы к книгам через релевантный поиск
     */
    private async linkFilesToBooks(): Promise<{
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
                .is('file_url', null);

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
            const validBooks = booksWithoutFiles?.filter((book: any) =>
                book.title && book.title.trim() !== '' &&
                book.author && book.author.trim() !== ''
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

            console.log(`  📚 Найдено ${validBooks.length} книг без файлов`);

            // Получаем ВСЕ файлы для сопоставления
            console.log(`  📥 Получаем список файлов для сопоставления...`);
            const filesToProcess = await this.fileService.getFilesToProcess(1000);
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
            console.error('  ❌ Ошибка при привязке файлов к книгам:', error);
            return {
                processed: 0,
                linked: 0,
                skipped: 0,
                errors: 1
            };
        }
    }

    /**
     * Находит соответствующий файл для книги с использованием алгоритма релевантного поиска
     */
    private findMatchingFile(book: Book, files: any[]): any | null {
        // Проверяем, что у книги есть название и автор
        if (!book.title || !book.author || book.title.trim() === '' || book.author.trim() === '') {
            console.log(`    ️  Книга не имеет названия или автора, пропускаем`);
            return null;
        }

        console.log(`    🔍 Поиск файла для книги: "${book.title}" автора ${book.author}`);

        // Используем более точный алгоритм поиска
        let bestMatch: any | null = null;
        let bestScore = 0;

        for (const file of files) {
            if (!file.filename) continue;

            const filename = file.filename.normalize('NFC').toLowerCase();
            const bookTitle = book.title.normalize('NFC').toLowerCase();
            const bookAuthor = book.author.normalize('NFC').toLowerCase();

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
            const titleInFilename = filename.includes(bookTitle.replace(/\s+/g, '_'));
            const authorInFilename = filename.includes(bookAuthor.replace(/\s+/g, '_'));

            // Если и название, и автор присутствуют, добавляем бонус
            if (titleInFilename && authorInFilename) {
                score += 30; // Большой бонус за полное совпадение
            }

            // Добавляем проверку на частичное совпадение слов в названии
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
            if (allWordsInTitle || allWordsInAuthor || wordsFoundCount > 0) {
                // Бонус зависит от количества найденных слов
                const wordBonus = Math.min(30, wordsFoundCount * 5);
                score += wordBonus;

                // Дополнительный бонус, если слова найдены и в названии, и в авторе
                if (titleWordsFound > 0 && authorWordsFound > 0) {
                    score += 10;
                }
            }

            // Если все слова включены и в название, и в автора, добавляем еще больший бонус
            if (allWordsInTitle && allWordsInAuthor) {
                score += 20;
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
     * Обрабатывает пакет метаданных
     */
    private async processMetadataBatch(messages: unknown[]): Promise<{
        processed: number;
        added: number;
        updated: number;
        skipped: number;
        errors: number;
    }> {
        let processed = 0;
        let added = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        const metadataList: BookMetadata[] = [];

        try {
            if (!this.metadataService) {
                throw new Error('Metadata service not initialized');
            }

            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                processed++;
                const anyMsg = msg as unknown as { [key: string]: unknown };
                console.log(`    📝 Обрабатываем сообщение ${anyMsg.id}...`);

                // Пропускаем сообщения без текста
                if (!(msg as { text?: string }).text) {
                    console.log(`      ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`);
                    skipped++;
                    continue;
                }

                // Парсим текст сообщения
                const metadata = MetadataParser.parseMessage((msg as { text: string }).text);
                metadata.messageId = anyMsg.id as number;

                // Проверяем, что у книги есть название и автор
                if (!metadata.title || !metadata.author || metadata.title.trim() === '' || metadata.author.trim() === '') {
                    console.log(`      ⚠️  Пропускаем сообщение ${anyMsg.id} (отсутствует название или автор)`);
                    skipped++;
                    continue;
                }

                // Проверяем наличие книги в БД
                let existingBook: Book | null = null;
                try {
                    const { data, error } = await serverSupabase
                        .from('books')
                        .select('id, telegram_post_id')
                        .eq('title', metadata.title)
                        .eq('author', metadata.author)
                        .limit(1)
                        .single();

                    if (!error && data) {
                        existingBook = data as Book;
                        console.log(`      ℹ️ Книга "${metadata.title}" автора ${metadata.author} найдена в БД.`);
                    }
                } catch (checkError) {
                    console.warn(`      ⚠️ Ошибка при проверке существования книги:`, checkError);
                }

                // Если книга существует, обновляем telegram_post_id если нужно
                if (existingBook) {
                    if (existingBook.telegram_post_id === null || existingBook.telegram_post_id !== (anyMsg.id as number)) {
                        console.log(`      🔄 Обновляем telegram_post_id для книги "${metadata.title}" (${existingBook.id})`);

                        const { error: updateError } = await serverSupabase
                            .from('books')
                            .update({
                                telegram_post_id: anyMsg.id as number,
                                updated_at: new Date().toISOString()
                            } as any)
                            .eq('id', existingBook.id);

                        if (updateError) {
                            console.error(`      ❌ Ошибка при обновлении telegram_post_id:`, updateError);
                            errors++;
                            continue;
                        }
                        updated++;
                    } else {
                        console.log(`      ✅ Книга "${metadata.title}" уже имеет корректный telegram_post_id, пропускаем`);
                        skipped++;
                    }
                    continue;
                }

                // Добавляем метаданные в список для импорта
                metadataList.push(metadata);
            }

            console.log(`    📊 Всего подготовлено метаданных: ${metadataList.length}`);

            // Импортируем метаданные с дедупликацией
            if (metadataList.length > 0) {
                console.log('    💾 Импортируем метаданные с дедупликацией...');
                const resultImport = await this.metadataService.importMetadataWithDeduplication(metadataList);
                added = resultImport.added;
                updated += resultImport.updated;
                skipped += resultImport.skipped;
                errors += resultImport.errors;
                console.log('    ✅ Импорт метаданных завершен');
            }

            return {
                processed,
                added,
                updated,
                skipped,
                errors
            };
        } catch (error) {
            console.error('    ❌ Ошибка при обработке пакета метаданных:', error);
            errors++;
            return {
                processed,
                added: 0,
                updated: 0,
                skipped,
                errors
            };
        }
    }

    /**
     * Получает все сообщения из канала метаданных
     */
    private async getAllMessagesFromMetadataChannel(): Promise<unknown[]> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            console.log('  📚 Получение всех сообщений из канала метаданных...');

            // Получаем канал с метаданными
            const channel = await this.telegramClient.getMetadataChannel();

            const channelId = typeof channel.id === 'object' && channel !== null ?
                (channel.id as { toString: () => string }).toString() :
                String(channel.id);

            // Получаем все сообщения из канала
            const allMessages = await this.telegramClient.getAllMessages(channelId, 100);

            console.log(`  ✅ Всего получено сообщений: ${allMessages.length}`);
            return allMessages;
        } catch (error) {
            console.error('  ❌ Ошибка при получении всех сообщений:', error);
            throw error;
        }
    }

    /**
     * Запускает сервис с указанным режимом работы
     * @param mode - режим работы: 'full' | 'update' | 'auto'
     */
    public async run(mode: 'full' | 'update' | 'auto' = 'auto'): Promise<SyncResult> {
        console.log(`🐋 Запуск Книжного Червя в режиме: ${mode.toUpperCase()}...`);

        switch (mode) {
            case 'full':
                return await this.runFullSync();
            case 'update':
                return await this.runUpdateSync();
            case 'auto':
            default:
                return await this.runAutoSync();
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