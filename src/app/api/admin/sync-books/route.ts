import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncBooks } from '@/scripts/sync-books';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/sync-books
 * Запускает синхронизацию книг из Telegram канала (по умолчанию 100 книг)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем токен из заголовка
    const token = authHeader.replace('Bearer ', '');
    
    // Проверяем пользователя через Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем, что пользователь - админ
    const { data: profile, error: profileError } = await supabaseAdmin
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

    // Получаем параметры из body (по умолчанию 100 книг)
    let limit = 100;
    if (request.body) {
      try {
        const body = await request.json();
        limit = body.limit || 100;
      } catch (parseError) {
        // Если не удалось распарсить JSON, используем значение по умолчанию
        console.warn('Failed to parse request body, using default limit of 100');
      }
    }

    // Запускаем синхронизацию книг
    const result = await syncBooks(limit);
    
    return NextResponse.json({
      message: 'Book sync completed',
      results: {
        success: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        errors: result.success ? [] : [result.message],
        actions: result.actions
      }
    });
  } catch (error) {
    console.error('Book sync error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}