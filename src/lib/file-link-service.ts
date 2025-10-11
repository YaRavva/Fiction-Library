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
      // Используем подход, аналогичный file-service.ts: messageId + extension
      let fileName = `${messageId}`;
      let fileExtension = '.fb2'; // По умолчанию

      const msg = message as any;
      if (msg.media && msg.media.document) {
        const document = msg.media.document;
        // Получаем расширение из оригинального имени файла
        const docFileName = document.attributes?.find((attr: any) => attr.fileName)?.fileName;
        if (docFileName) {
          const ext = docFileName.split('.').pop();
          if (ext) {
            fileExtension = `.${ext}`;
          }
        }
      }

      // Формируем имя файла как messageId + extension
      fileName = `${messageId}${fileExtension}`;

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
   * Получает информацию о файле из Telegram без загрузки
   */
  public async getFileInfo(
    messageId: number,
    channelId: number
  ): Promise<{ fileName: string; mimeType: string }> {
    try {
      console.log(`🔍 Получение информации о файле ${messageId} из канала ${channelId}...`);

      // Получаем сообщение с файлом
      const channelEntity = await this.telegramService.getChannelEntityById(channelId);
      const message = await this.telegramService.getMessageById(channelEntity, messageId);

      if (!message) {
        throw new Error(`Сообщение ${messageId} не найдено`);
      }

      // Определяем имя файла и MIME тип
      // Используем подход, аналогичный file-service.ts: messageId + extension
      let fileName = `${messageId}`;
      let fileExtension = '.fb2'; // По умолчанию

      const msg = message as any;
      if (msg.media && msg.media.document) {
        const document = msg.media.document;
        // Получаем расширение из оригинального имени файла
        const docFileName = document.attributes?.find((attr: any) => attr.fileName)?.fileName;
        if (docFileName) {
          const ext = docFileName.split('.').pop();
          if (ext) {
            fileExtension = `.${ext}`;
          }
        }
      }

      // Формируем имя файла как messageId + extension
      fileName = `${messageId}${fileExtension}`;

      const mimeType = this.detectMimeType(fileName);

      console.log(`✅ Информация о файле получена: ${fileName}`);

      return {
        fileName,
        mimeType
      };
    } catch (error) {
      console.error('Ошибка при получении информации о файле:', error);
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

      // Используем имя файла как есть, без добавления временных меток
      // Это соответствует подходу в file-service.ts
      const storagePath = `books/${fileName}`;

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
   * Привязывает уже существующий файл в storage к книге
   */
  public async linkExistingFileToBook(
    bookId: string,
    storagePath: string,
    fileName: string,
    mimeType: string,
    // Добавляем параметры для проверки соответствия
    expectedFileSize?: number,
    expectedFileExtension?: string
  ): Promise<FileLinkResult> {
    try {
      console.log(`🔗 Привязка существующего файла к книге ${bookId}...`);

      // Получаем информацию о файле из storage
      const { data: fileInfo, error: infoError } = await supabaseAdmin.storage
        .from('books')
        .list('books', {
          search: fileName
        });

      if (infoError || !fileInfo || fileInfo.length === 0) {
        throw new Error('Файл не найден в storage');
      }

      const file = fileInfo[0];
      const fileSize = file.metadata?.size || 0;

      // Предварительная проверка типа файла и размера
      const fileExtension = fileName.toLowerCase().split('.').pop();
      
      // Проверка допустимых форматов файлов
      const allowedFormats = ['fb2', 'zip'];
      if (!fileExtension || !allowedFormats.includes(fileExtension)) {
        // Если формат файла недопустимый, удаляем существующий файл и возвращаем ошибку
        await supabaseAdmin.storage.from('books').remove([storagePath]);
        throw new Error(`Недопустимый формат файла: ${fileExtension}. Разрешены только: fb2, zip`);
      }

      // Проверка размера файла (минимальный размер для fb2 - 100 байт, для zip - 1000 байт)
      let sizeCheckFailed = false;
      let sizeCheckError = '';
      
      if (fileExtension === 'fb2' && fileSize < 100) {
        sizeCheckFailed = true;
        sizeCheckError = `Файл fb2 слишком маленький: ${fileSize} байт. Минимальный размер: 100 байт`;
      }
      
      if (fileExtension === 'zip' && fileSize < 1000) {
        sizeCheckFailed = true;
        sizeCheckError = `Файл zip слишком маленький: ${fileSize} байт. Минимальный размер: 1000 байт`;
      }

      // Если проверка размера не пройдена, удаляем существующий файл и возвращаем ошибку
      if (sizeCheckFailed) {
        await supabaseAdmin.storage.from('books').remove([storagePath]);
        throw new Error(sizeCheckError);
      }

      // Проверка соответствия ожидаемого размера и типа (если переданы)
      if (expectedFileSize && expectedFileExtension) {
        const actualFileExtension = fileName.toLowerCase().split('.').pop();
        if (actualFileExtension !== expectedFileExtension || fileSize !== expectedFileSize) {
          console.log(`⚠️ Файл не соответствует ожиданиям. Ожидаемый тип: ${expectedFileExtension}, фактический: ${actualFileExtension}. Ожидаемый размер: ${expectedFileSize}, фактический: ${fileSize}`);
          
          // Удаляем существующий файл
          const { error: removeError } = await supabaseAdmin.storage.from('books').remove([storagePath]);
          if (removeError) {
            console.error('Ошибка при удалении существующего файла:', removeError);
          } else {
            console.log('✅ Существующий файл удален');
          }
          
          // Возвращаем специальную ошибку, чтобы вызывающая сторона знала, что нужно загрузить новый файл
          return {
            success: false,
            bookId,
            error: 'FILE_MISMATCH_NEEDS_REUPLOAD'
          };
        }
      }

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
          updated_at: new Date().toISOString()
        })
        .eq('id', bookId)
        .select()
        .single();

      if (error) {
        throw new Error(`Ошибка обновления книги: ${error.message}`);
      }

      console.log(`✅ Существующий файл успешно привязан к книге ${bookId}`);

      return {
        success: true,
        bookId,
        fileUrl: urlData.publicUrl,
        storagePath
      };
    } catch (error) {
      console.error('Ошибка при привязке существующего файла к книге:', error);

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