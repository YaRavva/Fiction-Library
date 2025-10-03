import { DownloadQueue } from './queue';
import { downloadFile } from './sync';
import { serverSupabase } from '@/lib/serverSupabase';
import { TelegramService } from './client';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'books';

export class DownloadWorker {
  private _queue: DownloadQueue | null = null;
  private isRunning: boolean = false;
  private currentTaskId: string | null = null;

  private get queue(): DownloadQueue {
    if (!this._queue) {
      this._queue = new DownloadQueue();
    }
    return this._queue;
  }

  /**
   * Запускает обработчик очереди
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    await this.processQueue();
  }

  /**
   * Останавливает обработчик очереди
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Основной цикл обработки очереди
   */
  private async processQueue() {
    while (this.isRunning) {
      try {
        const task = await this.queue.getNextTask();
        
        if (!task) {
          // Если нет задач, ждем 5 секунд
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        this.currentTaskId = task.id;

        // Скачиваем файл
        const { success, error } = await this.processTask(task);
        
        // Обновляем статус задачи
        await this.queue.completeTask(task.id, success, error);

        this.currentTaskId = null;

      } catch (error) {
        console.error('Error processing queue:', error);
        // Ждем 10 секунд перед следующей попыткой при ошибке
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  /**
   * Обрабатывает одну задачу загрузки
   */
  private async processTask(task: any) {
    try {
      if (!task.file_id) {
        return {
          success: false,
          error: 'Missing file_id'
        };
      }

      // Скачиваем файл из Telegram
      const fileBuffer = await downloadFile(task.file_id);
      if (!fileBuffer) {
        return {
          success: false,
          error: 'Failed to download file from Telegram'
        };
      }

      // Получаем информацию о сообщении для определения имени файла и MIME-типа
      let fileName = `${task.message_id}.fb2`;
      let fileFormat = 'fb2';
      let mimeType = 'application/octet-stream';
      let originalFileName = null;
      
      try {
        // Получаем канал с файлами
        const client = await TelegramService.getInstance();
        const channel = await client.getFilesChannel();
        
        // Получаем сообщения (получаем больше сообщений, чтобы увеличить шансы найти нужное)
        const messages = await client.getMessages(channel, 20);
        
        // Ищем сообщение с указанным ID
        let targetMessage = null;
        if (Array.isArray(messages)) {
          for (const msg of messages) {
            // @ts-ignore
            if (msg && msg.id === Number(task.message_id)) {
              targetMessage = msg;
              break;
            }
          }
        }
        
        if (targetMessage) {
          const anyMsg: any = targetMessage as any;
          
          // Определяем имя файла из атрибутов документа
          if (anyMsg.document && anyMsg.document.attributes) {
            const attrFileName = anyMsg.document.attributes.find((attr: any) => 
              attr.className === 'DocumentAttributeFilename'
            );
            if (attrFileName && attrFileName.fileName) {
              originalFileName = attrFileName.fileName;
              fileName = attrFileName.fileName;
              // Определяем формат файла по расширению
              const ext = fileName.split('.').pop()?.toLowerCase();
              if (ext) {
                fileFormat = ext;
                // Устанавливаем соответствующий MIME-тип
                mimeType = this.getMimeTypeByExtension(ext);
              }
            }
          }
          
          // Если имя файла не определено, используем ID сообщения с расширением
          if (!originalFileName) {
            fileName = `${task.message_id}.${fileFormat}`;
          }
        }
      } catch (msgError) {
        console.warn('Could not get message details for filename, using defaults:', msgError);
      }

      // Определяем путь для хранения файла
      // Используем оригинальное имя файла из Telegram, если оно есть
      let storageFileName = originalFileName || `${task.message_id}.${fileFormat}`;
      const storagePath = `books/${storageFileName}`;

      // Загружаем в Supabase Storage (используем server client с service role key)
      const { error: uploadError } = await serverSupabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        return {
          success: false,
          error: `Upload to storage failed: ${uploadError.message}`
        };
      }

      // Формируем URL файла
      const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

      // Обновляем запись в telegram_download_queue с путем к файлу
      const { error: updateQueueError } = await (serverSupabase
        .from('telegram_download_queue') as any)
        .update({
          storage_path: storagePath,
          status: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (updateQueueError) {
        console.warn('Failed to update telegram_download_queue:', updateQueueError);
      }

      // Проверяем, существует ли уже запись книги с таким telegram_file_id
      let existingBook: any = null;
      try {
        const { data, error: fetchError } = await (serverSupabase
          .from('books') as any)
          .select('*')
          .eq('telegram_file_id', task.file_id)
          .single();
        
        if (!fetchError && data) {
          existingBook = data;
        }
      } catch (fetchError) {
        console.warn('Error fetching existing book record:', fetchError);
      }

      // Если есть book_id в задаче, пытаемся получить запись книги по нему
      if (task.book_id && !existingBook) {
        try {
          const { data, error: fetchError } = await (serverSupabase
            .from('books') as any)
            .select('*')
            .eq('id', task.book_id)
            .single();
          
          if (!fetchError && data) {
            existingBook = data;
          }
        } catch (fetchError) {
          console.warn('Error fetching book record by book_id:', fetchError);
        }
      }

      // Создаем или обновляем запись книги в таблице books
      try {
        const bookRecord: any = {
          file_url: fileUrl,
          file_size: fileBuffer.length,
          file_format: fileFormat,
          telegram_file_id: task.file_id,
          storage_path: storagePath,
          updated_at: new Date().toISOString()
        };

        // Если есть существующая запись, обновляем её
        if (existingBook) {
          // Объединяем существующие данные с новыми
          bookRecord.title = existingBook.title || fileName.replace(/\.[^/.]+$/, "");
          bookRecord.author = existingBook.author || 'Unknown';
          
          const { error: updateBookError } = await (serverSupabase
            .from('books') as any)
            .update(bookRecord)
            .eq('id', existingBook.id);

          if (updateBookError) {
            console.warn('Failed to update book record:', updateBookError);
          } else {
            console.log(`✅ Book record updated for file: ${fileName}`);
          }
        } else {
          // Создаем новую запись
          bookRecord.title = fileName.replace(/\.[^/.]+$/, "");
          bookRecord.author = 'Unknown';
          bookRecord.created_at = new Date().toISOString();
          
          const { error: insertBookError } = await (serverSupabase
            .from('books') as any)
            .insert(bookRecord);

          if (insertBookError) {
            console.warn('Failed to insert book record:', insertBookError);
          } else {
            console.log(`✅ Book record created for file: ${fileName}`);
          }
        }
      } catch (bookError) {
        console.warn('Error creating/updating book record:', bookError);
      }

      // Если есть book_id, обновляем запись книги (если не обновили выше)
      if (task.book_id) {
        // Проверяем, обновляли ли мы уже эту запись
        if (!existingBook || existingBook.id !== task.book_id) {
          const { error: updateBookError } = await (serverSupabase
            .from('books') as any)
            .update({
              storage_path: storagePath,
              file_url: fileUrl,
              file_size: fileBuffer.length,
              file_format: fileFormat,
              telegram_file_id: task.file_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', task.book_id);

          if (updateBookError) {
            console.warn('Failed to update book record:', updateBookError);
          }
        }
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Возвращает MIME-тип по расширению файла
   */
  private getMimeTypeByExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      'fb2': 'application/fb2+xml',
      'epub': 'application/epub+zip',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'mobi': 'application/x-mobipocket-ebook',
      'azw': 'application/vnd.amazon.ebook',
      'azw3': 'application/vnd.amazon.ebook',
      'djvu': 'image/vnd.djvu',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Возвращает статус текущей задачи
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTaskId: this.currentTaskId
    };
  }
}