import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { join } from 'path';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    // Получаем параметры из body
    const body = await request.json();
    const mode = body.mode;

    // Валидация режима
    if (!mode || !['full', 'update'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode. Use "full" or "update"' }, { status: 400 });
    }

    // Запускаем скрипт "Книжного Червя" в отдельном процессе
    const scriptPath = join(process.cwd(), 'src', 'scripts', 'run-book-worm.ts');
    const child = spawn('npx', ['tsx', scriptPath, mode], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Отправляем ответ немедленно, не дожидаясь завершения процесса
    return NextResponse.json({ 
      success: true, 
      message: `Book Worm started in ${mode} mode`,
      mode,
      pid: child.pid
    });
    
  } catch (error) {
    console.error('Book Worm API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}