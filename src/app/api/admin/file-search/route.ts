import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FileSearchService, TelegramFile, BookWithoutFile } from '@/lib/file-search-service';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/admin/file-search called');

    // Проверяем авторизацию
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    let user = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user: bearerUser }, error: bearerError } = await supabaseAdmin.auth.getUser(token);
        if (!bearerError && bearerUser) {
          user = bearerUser;
        }
      } catch (bearerAuthError) {
        console.log('Bearer auth error (ignored):', bearerAuthError);
      }
    }
    
    if (!user) {
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      user = cookieUser;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { book, telegramFiles } = await request.json();

    if (!book || !telegramFiles) {
      return NextResponse.json(
        { error: 'Отсутствуют необходимые параметры: book или telegramFiles' },
        { status: 400 }
      );
    }

    const fileSearchService = new FileSearchService();
    const result = fileSearchService.searchFilesForBook(book as BookWithoutFile, telegramFiles as TelegramFile[]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/admin/file-search:', error);
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера',
        details: error instanceof Error ? error.message : 'Неизвестная ошибка',
      },
      { status: 500 }
    );
  }
}
