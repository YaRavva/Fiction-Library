import { DownloadQueue } from './queue';
import { downloadFile } from './sync';
import { serverSupabase } from '@/lib/serverSupabase';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'books';

export class DownloadWorker {
  private queue: DownloadQueue;
  private isRunning: boolean = false;
  private currentTaskId: string | null = null;

  constructor() {
    this.queue = new DownloadQueue();
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

      // Определяем путь для хранения файла
      const timestamp = Date.now();
      const fileName = `${task.message_id}_${timestamp}.fb2`;
      const storagePath = `${fileName}`;

      // Загружаем в Supabase Storage (используем server client с service role key)
      const { error: uploadError } = await serverSupabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: 'application/octet-stream',
          upsert: true
        });

      if (uploadError) {
        return {
          success: false,
          error: `Upload to storage failed: ${uploadError.message}`
        };
      }

      // Обновляем запись в download_queue с путем к файлу
      const { error: updateQueueError } = await serverSupabase
        .from('download_queue')
        .update({
          storage_path: storagePath,
          status: 'done',
          updated_at: new Date().toISOString()
        })
        .eq('telegram_file_id', task.file_id);

      if (updateQueueError) {
        console.warn('Failed to update download_queue:', updateQueueError);
      }

      // Если есть book_id, обновляем запись книги
      if (task.book_id) {
        const { error: updateBookError } = await serverSupabase
          .from('books')
          .update({
            storage_path: storagePath,
            sync_status: 'synced',
            updated_at: new Date().toISOString()
          })
          .eq('id', task.book_id);

        if (updateBookError) {
          console.warn('Failed to update book record:', updateBookError);
          // Не возвращаем ошибку, т.к. файл уже загружен
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
   * Возвращает статус текущей задачи
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTaskId: this.currentTaskId
    };
  }
}