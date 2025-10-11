import { NextRequest, NextResponse } from 'next/server';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
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
      const messages = await telegramClient.getAllMessages(channelId, 1000);

      // Фильтруем только сообщения с файлами
      const files = messages
        .filter((msg: any) => msg.media && (msg.media.document || msg.media.photo))
        .map((msg: any) => {
          const media = msg.media.document || msg.media.photo;
          const rawFileName = media?.fileName || media?.filename || `file_${msg.id}`;

          // Нормализуем имя файла в NFC форму для консистентности
          const normalizedFileName = rawFileName.normalize('NFC');

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