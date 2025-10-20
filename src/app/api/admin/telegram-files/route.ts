import { NextRequest, NextResponse } from 'next/server';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Извлекает оригинальное имя файла из сообщения Telegram
 * @param message Сообщение Telegram
 * @returns Оригинальное имя файла
 */
function getOriginalFilename(message: any): string {
  let originalFilename = `file_${message.id}`;

  try {
    // Попробуем получить имя файла из разных источников
    if (message.document) {
      // Проверяем атрибуты документа
      if (message.document.attributes) {
        const attributes = message.document.attributes;
        for (const attr of attributes) {
          if (attr && attr.className === 'DocumentAttributeFilename' && attr.fileName) {
            originalFilename = attr.fileName;
            break;
          }
        }
      }
      
      // Если не нашли в атрибутах, проверяем напрямую в document
      if (originalFilename === `file_${message.id}` && message.document.fileName) {
        originalFilename = message.document.fileName;
      }
    }
    
    // Проверяем в корне сообщения
    if (originalFilename === `file_${message.id}` && message.fileName) {
      originalFilename = message.fileName;
    }
    
    // Если все еще не нашли, проверяем media
    if (originalFilename === `file_${message.id}` && message.media) {
      const media = message.media.document || message.media.photo;
      if (media && media.fileName) {
        originalFilename = media.fileName;
      } else if (media && media.filename) {
        originalFilename = media.filename;
      }
    }
  } catch (error) {
    console.warn(`Ошибка при извлечении имени файла для сообщения ${message.id}:`, error);
  }

  return originalFilename;
}

/**
 * GET /api/admin/telegram-files
 * Получает список всех файлов из приватного Telegram канала
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Проверяем пользователя через Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем, что пользователь - админ
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Получаем файлы из Telegram через существующий сервис
    const { TelegramService } = await import('@/lib/telegram/client');
    const telegramClient = await TelegramService.getInstance();

    try {
      // Получаем канал с файлами
      const fileChannel = await telegramClient.getFilesChannel();

      // Получаем все сообщения с файлами
      const channelId = typeof fileChannel.id === 'object' && fileChannel.id !== null ?
        (fileChannel.id as { toString: () => string }).toString() :
        String(fileChannel.id);

      console.log(`📂 Загрузка файлов из канала ${channelId}...`);
      const messages = await telegramClient.getAllMessages(channelId, 10000);

      // Фильтруем только сообщения с файлами
      const files = messages
        .filter((msg: any) => msg.media && (msg.media.document || msg.media.photo))
        .map((msg: any) => {
          // Используем улучшенную логику для извлечения имени файла
          const rawFileName = getOriginalFilename(msg);

          // Нормализуем имя файла в NFC форму для консистентности
          const normalizedFileName = rawFileName.normalize('NFC');

          // Получаем media объект
          const media = msg.media.document || msg.media.photo;

          return {
            message_id: msg.id,
            file_name: normalizedFileName,
            file_size: media?.size || 0,
            mime_type: media?.mimeType || media?.mime_type,
            caption: msg.message || '',
            date: msg.date || Date.now() / 1000
          };
        });

      return NextResponse.json({
        files,
        total: files.length
      });

    } catch (telegramError) {
      console.error('Telegram API error:', telegramError);
      return NextResponse.json(
        { error: 'Failed to fetch files from Telegram', details: (telegramError as Error).message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error getting Telegram files:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}