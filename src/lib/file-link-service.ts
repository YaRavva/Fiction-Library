import { createClient } from '@supabase/supabase-js';
import { FileSearchService, BookWithoutFile, TelegramFile } from './file-search-service';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export interface FileLinkResult {
  success: boolean;
  bookId: string;
  fileUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Сервис для загрузки файлов в storage и привязки к книгам
 */
export class FileLinkService {
  private static instance: FileLinkService;
  private telegramService: any;

  public static async getInstance(): Promise<FileLinkService> {
    if (!FileLinkService.instance) {
      FileLinkService.instance = new FileLinkService();
      await FileLinkService.instance.initialize();
    }
    return FileLinkService.instance;
  }

  private async initialize() {
    try {
      const { TelegramService } = await import('./telegram/client');
      this.telegramService = await TelegramService.getInstance();
    } catch (error) {
      console.error('Ошибка инициализации Telegram сервиса:', error);
      throw error;
    }
  }

  /**
   * Загружает файл из Telegram и сохраняет в storage
   */
  public async downloadAndUploadFile(
    messageId: number,
    channelId: number,
    book: BookWithoutFile
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    try {
      console.log(`📥 Загрузка файла ${messageId} из канала ${channelId}...`);

      // Получаем сообщение с файлом
      const channelEntity = await this.telegramService.getChannelEntityById(channelId);
      const message = await this.telegramService.getMessageById(channelEntity, messageId);

      if (!message) {
        throw new Error(`Сообщение ${messageId} не найдено`);
      }

      // Загружаем файл
      const fileBuffer = await this.telegramService.downloadMedia(message);

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Файл пустой или не удалось загрузить');
      }

      // Определяем имя файла и MIME тип
      const msg = message as any;
      let fileName = `book_${book.id}_${messageId}`;

      if (msg.media && msg.media.document) {
        const document = msg.media.document;
        const docFileName = document.attributes?.find((attr: any) => attr.fileName)?.fileName;
        if (docFileName) {
          fileName = this.sanitizeFileName(docFileName);
        }
      }

      const mimeType = this.detectMimeType(fileName);

      console.log(`✅ Файл загружен: ${fileName} (${fileBuffer.length} bytes)`);

      return {
        buffer: fileBuffer,
        fileName,
        mimeType
      };
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      throw error;
    }
  }

  /**
   * Сохраняет файл в Supabase Storage
   */
  public async uploadToStorage(
    fileName: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    try {
      console.log(`☁️ Загрузка файла в storage: ${fileName}...`);

      // Генерируем уникальное имя файла
      const uniqueFileName = `${Date.now()}_${fileName}`;
      const storagePath = `books/${uniqueFileName}`;

      // Загружаем файл в storage
      const { data, error } = await supabaseAdmin.storage
        .from('books')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false
        });

      if (error) {
        throw new Error(`Ошибка загрузки в storage: ${error.message}`);
      }

      // Получаем публичный URL
      const { data: urlData } = supabaseAdmin.storage
        .from('books')
        .getPublicUrl(storagePath);

      console.log(`✅ Файл загружен в storage: ${urlData.publicUrl}`);

      return storagePath;
    } catch (error) {
      console.error('Ошибка при загрузке в storage:', error);
      throw error;
    }
  }

  /**
   * Привязывает файл к книге в базе данных
   */
  public async linkFileToBook(
    bookId: string,
    storagePath: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    telegramFileId?: string
  ): Promise<FileLinkResult> {
    try {
      console.log(`🔗 Привязка файла к книге ${bookId}...`);

      // Получаем публичный URL файла
      const { data: urlData } = supabaseAdmin.storage
        .from('books')
        .getPublicUrl(storagePath);

      // Определяем формат файла
      const fileFormat = this.detectFileFormat(fileName);

      // Обновляем запись книги
      const { data, error } = await supabaseAdmin
        .from('books')
        .update({
          file_url: urlData.publicUrl,
          storage_path: storagePath,
          file_size: fileSize,
          file_format: fileFormat,
          telegram_file_id: telegramFileId,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookId)
        .select()
        .single();

      if (error) {
        throw new Error(`Ошибка обновления книги: ${error.message}`);
      }

      console.log(`✅ Файл успешно привязан к книге ${bookId}`);

      return {
        success: true,
        bookId,
        fileUrl: urlData.publicUrl,
        storagePath
      };
    } catch (error) {
      console.error('Ошибка при привязке файла к книге:', error);

      return {
        success: false,
        bookId,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }

  /**
   * Выполняет полный процесс: загрузка файла и привязка к книге
   */
  public async processFileForBook(
    messageId: number,
    channelId: number,
    book: BookWithoutFile
  ): Promise<FileLinkResult> {
    try {
      console.log(`🚀 Начало обработки файла для книги: ${book.title} - ${book.author}`);

      // Шаг 1: Загружаем файл из Telegram
      const { buffer, fileName, mimeType } = await this.downloadAndUploadFile(
        messageId,
        channelId,
        book
      );

      // Шаг 2: Загружаем в storage
      const storagePath = await this.uploadToStorage(fileName, buffer, mimeType);

      // Шаг 3: Привязываем к книге
      const result = await this.linkFileToBook(
        book.id,
        storagePath,
        fileName,
        buffer.length,
        mimeType
      );

      if (result.success) {
        console.log(`✅ Файл успешно обработан и привязан к книге`);
      }

      return result;
    } catch (error) {
      console.error('Ошибка при обработке файла:', error);

      return {
        success: false,
        bookId: book.id,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }

  /**
   * Очищает имя файла от недопустимых символов
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Заменяем недопустимые символы
      .replace(/\s+/g, '_') // Заменяем пробелы на подчеркивания
      .substring(0, 100); // Ограничиваем длину
  }

  /**
   * Определяет MIME тип по имени файла
   */
  private detectMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();

    switch (ext) {
      case 'fb2':
        return 'application/fb2';
      case 'epub':
        return 'application/epub+zip';
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'zip':
        return 'application/zip';
      case 'rar':
        return 'application/x-rar-compressed';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Определяет формат файла по имени
   */
  private detectFileFormat(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();

    switch (ext) {
      case 'fb2':
        return 'fb2';
      case 'epub':
        return 'epub';
      case 'pdf':
        return 'pdf';
      case 'txt':
        return 'txt';
      case 'zip':
        return 'zip';
      case 'rar':
        return 'rar';
      default:
        return 'fb2'; // По умолчанию считаем fb2
    }
  }
}