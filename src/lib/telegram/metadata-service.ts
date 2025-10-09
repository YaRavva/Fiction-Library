import { TelegramService } from './client';
import { MetadataParser, BookMetadata } from './parser';
import { uploadFileToStorage, upsertBookRecord } from '../supabase';
import { serverSupabase } from '../serverSupabase';
import { Message } from 'node-telegram-bot-api';

export class TelegramMetadataService {
    private static instance: TelegramMetadataService;
    private telegramClient: TelegramService | null = null;

    private constructor() {}

    public static async getInstance(): Promise<TelegramMetadataService> {
        if (!TelegramMetadataService.instance) {
            TelegramMetadataService.instance = new TelegramMetadataService();
            TelegramMetadataService.instance.telegramClient = await TelegramService.getInstance();
        }
        return TelegramMetadataService.instance;
    }

    /**
     * Синхронизирует книги из Telegram канала с учетом уже обработанных сообщений
     * @param limit Количество сообщений для обработки (по умолчанию 10)
     */
    public async syncBooks(limit: number = 10): Promise<{ processed: number; added: number; updated: number; skipped: number; errors: number; details: unknown[] }> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }

        try {
            console.log(`🚀 Начинаем синхронизацию книг (лимит: ${limit})`);
            
            // Получаем ID последнего обработанного сообщения
            console.log('🔍 Получаем ID последнего обработанного сообщения...');
            // @ts-ignore
            const { data: lastProcessed, error: lastProcessedError } = await serverSupabase
                .from('telegram_processed_messages')
                .select('message_id')
                .order('processed_at', { ascending: false })
                .limit(1)
                .single();

            let offsetId: number | undefined = undefined;
            if (!lastProcessedError && lastProcessed && (lastProcessed as { message_id?: string }).message_id) {
                // Если есть последнее обработанное сообщение, начинаем с него
                offsetId = parseInt((lastProcessed as { message_id: string }).message_id, 10);
                console.log(`  📌 Начинаем с сообщения ID: ${offsetId}`);
            } else {
                console.log('  🆕 Начинаем с самых новых сообщений');
            }

            // Получаем канал с метаданными
            console.log('📡 Получаем канал с метаданными...');
            const channel = await this.telegramClient.getMetadataChannel();

            // Convert BigInteger to string for compatibility
            const channelId = typeof channel.id === 'object' && channel.id !== null ? 
                (channel.id as { toString: () => string }).toString() : 
                String(channel.id);

            // Получаем сообщения с пагинацией
            console.log(`📥 Получаем сообщения (лимит: ${limit}, offsetId: ${offsetId})...`);
            const messages = await this.telegramClient.getMessages(channelId, limit, offsetId) as unknown as Message[];
            console.log(`✅ Получено ${messages.length} сообщений\n`);

            // Парсим метаданные из каждого сообщения
            const metadataList: BookMetadata[] = [];
            const details: unknown[] = []; // Объявляем details здесь для использования в цикле
            
            // Обрабатываем каждое сообщение
            for (const msg of messages) {
                const anyMsg = msg as unknown as { [key: string]: unknown };
                console.log(`📝 Обрабатываем сообщение ${anyMsg.id}...`);

                // Пропускаем сообщения без текста
                if (!(msg as { text?: string }).text) {
                    console.log(`  ℹ️ Сообщение ${anyMsg.id} не содержит текста, пропускаем`);
                    // Добавляем запись в details о пропущенном сообщении
                    details.push({ 
                        msgId: anyMsg.id, 
                        status: 'skipped', 
                        reason: 'no text content'
                    });
                    continue;
                }

                // Парсим текст сообщения
                const metadata = MetadataParser.parseMessage((msg as { text: string }).text);
                // Добавляем ID сообщения в метаданные
                metadata.messageId = anyMsg.id as number;

                // Проверяем, что у книги есть название и автор
                if (!metadata.title || !metadata.author || metadata.title.trim() === '' || metadata.author.trim() === '') {
                    console.log(`  ⚠️  Пропускаем сообщение ${anyMsg.id} (отсутствует название или автор)`);
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
                        console.log(`  ℹ️ Книга "${metadata.title}" автора ${metadata.author} уже существует в БД, пропускаем`);
                    }
                } catch (checkError) {
                    console.warn(`  ⚠️ Ошибка при проверке существования книги:`, checkError);
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
                    console.log(`  📸 Обнаружено медиа в сообщении ${anyMsg.id} (тип: ${(anyMsg.media as { className: string }).className})`);
                    
                    // Функция для повторных попыток загрузки с увеличенным таймаутом
                    const downloadWithRetry = async (media: unknown, maxRetries = 3) => {
                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            try {
                                console.log(`    → Попытка загрузки ${attempt}/${maxRetries}...`);
                                if (!this.telegramClient) {
                                    throw new Error('Telegram client not initialized');
                                }
                                const result = await Promise.race([
                                    this.telegramClient.downloadMedia(media),
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
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
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
                                await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
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
                                    await uploadFileToStorage('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg');
                                    const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${photoKey}`;
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

            console.log(`📊 Всего подготовлено метаданных: ${metadataList.length}`);
            
            // Импортируем метаданные с дедупликацией
            console.log('💾 Импортируем метаданные с дедупликацией...');
            const resultImport = await this.importMetadataWithDeduplication(metadataList);
            
            // Объединяем details из обоих этапов
            const combinedDetails = [...details, ...resultImport.details];
            console.log('✅ Импорт метаданных завершен');
            
            // Общее количество пропущенных книг (из обоих этапов)
            const totalSkipped = resultImport.skipped + details.filter(d => (d as { status: string }).status === 'skipped').length;
            
            // Выводим сводку
            console.log('\n📊 СВОДКА СИНХРОНИЗАЦИИ:');
            console.log(`   ========================================`);
            console.log(`   Обработано сообщений: ${messages.length}`);
            console.log(`   Подготовлено метаданных: ${metadataList.length}`);
            console.log(`   Добавлено книг: ${resultImport.added}`);
            console.log(`   Обновлено книг: ${resultImport.updated}`);
            console.log(`   Пропущено сообщений: ${totalSkipped}`);
            console.log(`   Ошибок: ${resultImport.errors}`);
            console.log(`   Всего обработано: ${resultImport.processed}`);
            
            return {
                processed: resultImport.processed,
                added: resultImport.added,
                updated: resultImport.updated,
                skipped: totalSkipped,
                errors: resultImport.errors,
                details: combinedDetails
            };
        } catch (error) {
            console.error('Error in syncBooks:', error);
            throw error;
        }
    }

    /**
     * Импортирует метаданные из Telegram в БД с учётом последних обработанных публикаций
     * @param metadata Массив метаданных книг для импорта
     */
    public async importMetadataWithDeduplication(metadata: BookMetadata[]): Promise<{ processed: number; added: number; updated: number; skipped: number; errors: number; details: unknown[] }> {
        if (!this.telegramClient) {
            throw new Error('Telegram client not initialized');
        }
        let processed = 0, added = 0, updated = 0, skipped = 0, errors = 0;
        const details: unknown[] = [];
        try {
            console.log(`📥 Импорт ${metadata.length} записей метаданных с дедупликацией`);
            
            // Обрабатываем каждую запись метаданных
            for (const book of metadata) {
                const msgId = book.messageId;
                
                // Проверяем наличие книги в БД по названию и автору
                // @ts-ignore
                const { data: foundBooks, error: findError } = await serverSupabase
                    .from('books')
                    .select('*')
                    .eq('title', book.title)
                    .eq('author', book.author);
                    
                if (findError) {
                    errors++;
                    details.push({ msgId, status: 'error', error: findError.message });
                    continue;
                }
                
                // Проверка на дублирование
                if (foundBooks && foundBooks.length > 0) {
                    // Книга уже существует, обновляем метаданные если нужно
                    const existingBook: any = foundBooks[0];
                    let needUpdate = false;
                    const updateData: { [key: string]: unknown } = {};
                    
                    // Обновляем только если новые данные лучше существующих
                    if (!existingBook.description && book.description) {
                        updateData.description = book.description;
                        needUpdate = true;
                    }
                    
                    if (book.genres && book.genres.length > 0 && (!existingBook.genres || existingBook.genres.length === 0)) {
                        updateData.genres = book.genres;
                        needUpdate = true;
                    }
                    
                    if (book.tags && book.tags.length > 0 && (!existingBook.tags || existingBook.tags.length === 0)) {
                        updateData.tags = book.tags;
                        needUpdate = true;
                    }
                    
                    // Обновляем обложку, если у новой книги есть обложки, а у существующей нет
                    if (book.coverUrls && book.coverUrls.length > 0 && (!existingBook.cover_url || existingBook.cover_url === '')) {
                        updateData.cover_url = book.coverUrls[0]; // Берем первую обложку
                        needUpdate = true;
                    }
                    
                    // Обновляем telegram_post_id для связи с публикацией в Telegram
                    if (msgId && (!existingBook.telegram_post_id || existingBook.telegram_post_id === '')) {
                        updateData.telegram_post_id = String(msgId);
                        needUpdate = true;
                    }
                    
                    // Если у книги есть состав (books.length > 0), но она не привязана к серии, создаем серию
                    if (book.books && book.books.length > 0 && (!existingBook.series_id || existingBook.series_id === '')) {
                        console.log(`  📚 У книги есть состав, но она не привязана к серии. Создаем серию...`);
                        
                        // Создаем серию
                        const seriesData: any = {
                            title: book.title,
                            author: book.author,
                            description: book.description || existingBook.description || '',
                            genres: book.genres && book.genres.length > 0 ? book.genres : existingBook.genres || [],
                            tags: book.tags && book.tags.length > 0 ? book.tags : existingBook.tags || [],
                            rating: book.rating || existingBook.rating || null,
                            telegram_post_id: String(msgId),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        
                        // Добавляем обложку, если она есть
                        if (book.coverUrls && book.coverUrls.length > 0) {
                            seriesData.cover_url = book.coverUrls[0]; // Берем первую обложку
                        } else if (existingBook.cover_url) {
                            seriesData.cover_url = existingBook.cover_url;
                        }
                        
                        // Добавляем состав серии, если он есть
                        if (book.books && book.books.length > 0) {
                            // Преобразуем книги в формат series_composition
                            const seriesComposition = book.books.map(b => ({
                                title: b.title,
                                year: b.year
                            }));
                            seriesData.series_composition = seriesComposition;
                        }
                        
                        // @ts-ignore
                        const { data: insertedSeries, error: seriesError } = await serverSupabase.from('series').insert(seriesData).select().single();
                        if (seriesError) {
                            console.warn(`  ⚠️  Ошибка при создании серии:`, seriesError);
                        } else {
                            const newSeriesId = (insertedSeries as any).id;
                            updateData.series_id = newSeriesId;
                            needUpdate = true;
                            console.log(`  ✅ Серия создана и привязана к книге: ${newSeriesId}`);
                        }
                    }
                    
                    if (needUpdate) {
                        console.log(`  🔄 Обновляем книгу "${existingBook.title}" автора ${existingBook.author}`);
                        // @ts-ignore
                        const { error: updateError } = await serverSupabase.from('books').update(updateData).eq('id', existingBook.id);
                        if (updateError) {
                            errors++;
                            details.push({ msgId, status: 'error', error: updateError.message });
                            continue;
                        }
                        updated++;
                        details.push({ 
                            msgId, 
                            status: 'updated', 
                            bookId: existingBook.id,
                            bookTitle: existingBook.title,
                            bookAuthor: existingBook.author
                        });
                    } else {
                        skipped++;
                        // Определяем конкретную причину пропуска
                        let skipReason = 'metadata complete';
                        if (existingBook.description && existingBook.description !== '' && (!book.description || book.description === '')) {
                            skipReason = 'existing book has description';
                        } else if (existingBook.genres && existingBook.genres.length > 0 && (!book.genres || book.genres.length === 0)) {
                            skipReason = 'existing book has genres';
                        } else if (existingBook.tags && existingBook.tags.length > 0 && (!book.tags || book.tags.length === 0)) {
                            skipReason = 'existing book has tags';
                        } else if (existingBook.cover_url && existingBook.cover_url !== '' && (!book.coverUrls || book.coverUrls.length === 0)) {
                            skipReason = 'existing book has cover';
                        } else if (existingBook.telegram_post_id && existingBook.telegram_post_id !== '' && !msgId) {
                            skipReason = 'existing book has telegram post id';
                        } else {
                            // Если у существующей книги нет преимуществ, пропускаем по причине дубликата
                            skipReason = 'book already exists in database';
                        }
                        
                        console.log(`  → Пропускаем книгу "${existingBook.title}" автора ${existingBook.author} (${skipReason})`);
                        details.push({ 
                            msgId, 
                            status: 'skipped', 
                            reason: skipReason,
                            bookTitle: existingBook.title,
                            bookAuthor: existingBook.author
                        });
                    }
                    
                    // Запись в telegram_processed_messages
                    // @ts-ignore
                    const { error: upsertError1 } = await serverSupabase.from('telegram_processed_messages').upsert({ 
                        message_id: String(msgId),
                        channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '',
                        book_id: existingBook.id,
                        processed_at: new Date().toISOString()
                    });
                    if (upsertError1) {
                        errors++;
                        details.push({ msgId, status: 'error', error: upsertError1.message });
                    }
                } else {
                    // Книга не найдена — добавляем новую
                    // Проверяем, есть ли у книги хотя бы название и автор
                    if (!book.title || !book.author) {
                        skipped++;
                        console.log(`  → Пропускаем сообщение ${msgId} (отсутствует название или автор)`);
                        details.push({ 
                            msgId, 
                            status: 'skipped', 
                            reason: 'missing title or author',
                            bookTitle: book.title || 'unknown',
                            bookAuthor: book.author || 'unknown'
                        });
                        continue;
                    }
                    
                    // Проверяем, есть ли у книги состав (книги в серии)
                    let seriesId = null;
                    if (book.books && book.books.length > 0) {
                        console.log(`  📚 У книги есть состав, создаем серию...`);
                        
                        // Создаем серию
                        const seriesData: any = {
                            title: book.title,
                            author: book.author,
                            description: book.description || '',
                            genres: book.genres || [],
                            tags: book.tags || [],
                            rating: book.rating || null,
                            telegram_post_id: String(msgId),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        
                        // Добавляем обложку, если она есть
                        if (book.coverUrls && book.coverUrls.length > 0) {
                            seriesData.cover_url = book.coverUrls[0]; // Берем первую обложку
                        }
                        
                        // Добавляем состав серии, если он есть
                        if (book.books && book.books.length > 0) {
                            // Преобразуем книги в формат series_composition
                            const seriesComposition = book.books.map(b => ({
                                title: b.title,
                                year: b.year
                            }));
                            seriesData.series_composition = seriesComposition;
                        }
                        
                        // @ts-ignore
                        const { data: insertedSeries, error: seriesError } = await serverSupabase.from('series').insert(seriesData).select().single();
                        if (seriesError) {
                            console.warn(`  ⚠️  Ошибка при создании серии:`, seriesError);
                        } else {
                            seriesId = (insertedSeries as any).id;
                            console.log(`  ✅ Серия создана: ${seriesId}`);
                        }
                    }
                    
                    console.log(`  ➕ Добавляем новую книгу: "${book.title}" автора ${book.author}`);
                    const newBook = {
                        title: book.title,
                        author: book.author,
                        description: book.description || '',
                        genres: book.genres || [],
                        tags: book.tags || [],
                        rating: book.rating || null,
                        telegram_post_id: String(msgId), // Используем telegram_post_id вместо telegram_file_id
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    
                    // Добавляем обложку, если она есть
                    if (book.coverUrls && book.coverUrls.length > 0) {
                        // @ts-ignore
                        newBook.cover_url = book.coverUrls[0]; // Берем первую обложку
                    }
                    
                    // Привязываем книгу к серии, если она была создана
                    if (seriesId) {
                        // @ts-ignore
                        newBook.series_id = seriesId;
                    }
                    
                    // @ts-ignore
                    const { data: inserted, error: insertError } = await serverSupabase.from('books').insert(newBook).select().single();
                    if (insertError) {
                        errors++;
                        details.push({ msgId, status: 'error', error: insertError.message });
                        continue;
                    }
                    
                    added++;
                    // @ts-ignore
                    details.push({ 
                        msgId, 
                        status: 'added', 
                        bookId: (inserted as any).id,
                        bookTitle: (inserted as any).title,
                        bookAuthor: (inserted as any).author
                    });
                    
                    // Запись в telegram_processed_messages
                    // @ts-ignore
                    const { error: upsertError2 } = await serverSupabase.from('telegram_processed_messages').upsert({ 
                        message_id: String(msgId),
                        channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '',
                        // @ts-ignore
                        book_id: (inserted as any).id,
                        processed_at: new Date().toISOString()
                    });
                    if (upsertError2) {
                        errors++;
                        details.push({ msgId, status: 'error', error: upsertError2.message });
                    }
                }
                processed++;
            }
            console.log(`📊 Импорт завершен: ${processed} обработано, ${added} добавлено, ${updated} обновлено, ${skipped} пропущено, ${errors} ошибок`);
            return { processed, added, updated, skipped, errors, details };
        } catch (error) {
            console.error('❌ Ошибка в importMetadataWithDeduplication:', error);
            throw error;
        }
    }
}