import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { normalizeBookText, checkForBookDuplicates, selectBestBookFromDuplicates, removeBookDuplicates } from '@/lib/book-deduplication-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface UserProfile {
  id: string;
  username?: string;
  display_name?: string;
  role: string;
}

/**
 * GET /api/admin/duplicates
 * Поиск дубликатов книг
 */
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/admin/duplicates called');
    
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

    // Проверяем заголовок Authorization
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
        // Игнорируем ошибки аутентификации через Bearer токен
        console.log('Bearer auth error (ignored):', bearerAuthError);
      }
    }
    
    // Если не удалось авторизоваться через Bearer токен, пробуем через cookies
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

    // Проверяем роль пользователя
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Недостаточно прав для выполнения операции' },
        { status: 403 }
      );
    }

    // Получаем все книги из базы данных с постраничной загрузкой (аналогично check-book-duplicates.ts)
    console.log('📥 Получение всех книг из базы данных...');
    const allBooks = [];
    let lastCreatedAt = null;
    const batchSize = 1000; // Получаем по 1000 записей за раз

    while (true) {
      let query = supabaseAdmin
        .from('books')
        .select('*')
        .order('created_at', { ascending: false }) // Сортируем по дате создания, новые первыми
        .limit(batchSize);

      if (lastCreatedAt) {
        query = query.lt('created_at', lastCreatedAt); // Получаем книги, созданные раньше lastCreatedAt
      }

      const { data: batch, error } = await query;

      if (error) {
        throw new Error(`Ошибка при получении книг: ${error.message}`);
      }

      if (!batch || batch.length === 0) {
        break;
      }

      allBooks.push(...batch);
      lastCreatedAt = batch[batch.length - 1].created_at; // Берем самую раннюю дату из текущей партии

      console.log(`  → Получено ${batch.length} книг, всего: ${allBooks.length}`);

      // Если получено меньше batch size, значит это последняя страница
      if (batch.length < batchSize) {
        break;
      }

      // Небольшая пауза между запросами, чтобы не перегружать сервер
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (allBooks.length === 0) {
      return NextResponse.json({
        message: 'В базе данных нет книг для проверки',
        duplicateGroups: [],
        stats: {
          totalBooks: 0,
          duplicateGroups: 0,
          potentialDuplicates: 0
        }
      });
    }

    console.log(`✅ Всего получено книг: ${allBooks.length}`);

    // Группируем книги по автору и названию для поиска потенциальных дубликатов
    const booksByAuthorTitle = new Map<string, typeof allBooks>();
    
    for (const book of allBooks) {
      // Пропускаем книги с пустыми названиями или авторами
      if (!book.title || !book.author) {
        continue;
      }
      const normalizedAuthor = normalizeBookText(book.author);
      const normalizedTitle = normalizeBookText(book.title);
      const key = `${normalizedAuthor}|${normalizedTitle}`;
      
      if (!booksByAuthorTitle.has(key)) {
        booksByAuthorTitle.set(key, []);
      }
      booksByAuthorTitle.get(key)?.push(book);
    }

    // Находим группы с более чем одной книгой (потенциальные дубликаты)
    const duplicateGroups = Array.from(booksByAuthorTitle.entries())
      .filter(([_, books]) => books.length > 1)
      .map(([key, books]) => ({ 
        author: books[0].author, 
        title: books[0].title, 
        books 
      }));

    console.log(`\n📊 Найдено ${duplicateGroups.length} групп дубликатов книг:`);

    let totalDuplicatesFound = 0;
    const detailedGroups = duplicateGroups.map(group => {
      totalDuplicatesFound += group.books.length - 1; // Исключаем одну оставшуюся книгу
      
      const booksInfo = group.books.map((book, index) => ({
        id: book.id,
        created_at: book.created_at,
        file_url: book.file_url ? 'ДА' : 'НЕТ',
        description: book.description ? 'ДА' : 'НЕТ',
        cover_url: book.cover_url ? 'ДА' : 'НЕТ',
        is_newest: index === 0 // Самая новая книга будет первой после сортировки
      }));
      
      return {
        author: group.author,
        title: group.title,
        count: group.books.length,
        books: booksInfo
      };
    });

    // Выводим информацию в консоль
    for (const group of detailedGroups) {
      console.log(`\n📖 Автор: "${group.author}", Название: "${group.title}"`);
      console.log(`  Количество книг в группе: ${group.count}`);
      
      for (let i = 0; i < group.books.length; i++) {
        const book = group.books[i];
        console.log(`    ${i + 1}. ID: ${book.id}, Дата создания: ${book.created_at}, Файл: ${book.file_url}`);
      }
    }

    // Выводим статистику
    const stats = {
      totalBooks: allBooks.length,
      duplicateGroups: duplicateGroups.length,
      potentialDuplicates: totalDuplicatesFound,
      uniqueBooksEstimate: allBooks.length - totalDuplicatesFound
    };

    console.log(`\n📊 Сводка:`);
    console.log(`  - Всего книг в базе: ${stats.totalBooks}`);
    console.log(`  - Групп дубликатов: ${stats.duplicateGroups}`);
    console.log(`  - Найдено дубликатов: ${stats.potentialDuplicates}`);
    console.log(`  - Примерное количество уникальных книг: ${stats.uniqueBooksEstimate}`);

    return NextResponse.json({
      message: `Найдено ${duplicateGroups.length} групп дубликатов`,
      duplicateGroups: detailedGroups,
      stats
    });

  } catch (error) {
    console.error('❌ Ошибка при поиске дубликатов:', error);
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера', 
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/duplicates
 * Удаление дубликатов книг
 */
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/admin/duplicates called');
    
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

    // Проверяем заголовок Authorization
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
        // Игнорируем ошибки аутентификации через Bearer токен
        console.log('Bearer auth error (ignored):', bearerAuthError);
      }
    }
    
    // Если не удалось авторизоваться через Bearer токен, пробуем через cookies
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

    // Проверяем роль пользователя
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Недостаточно прав для выполнения операции' },
        { status: 403 }
      );
    }

    // Получаем все книги из базы данных с постраничной загрузкой (аналогично check-book-duplicates.ts)
    console.log('📥 Получение всех книг из базы данных...');
    const allBooks = [];
    let lastCreatedAt = null;
    const batchSize = 1000; // Получаем по 1000 записей за раз

    while (true) {
      let query = supabaseAdmin
        .from('books')
        .select('*')
        .order('created_at', { ascending: false }) // Сортируем по дате создания, новые первыми
        .limit(batchSize);

      if (lastCreatedAt) {
        query = query.lt('created_at', lastCreatedAt); // Получаем книги, созданные раньше lastCreatedAt
      }

      const { data: batch, error } = await query;

      if (error) {
        throw new Error(`Ошибка при получении книг: ${error.message}`);
      }

      if (!batch || batch.length === 0) {
        break;
      }

      allBooks.push(...batch);
      lastCreatedAt = batch[batch.length - 1].created_at; // Берем самую раннюю дату из текущей партии

      console.log(`  → Получено ${batch.length} книг, всего: ${allBooks.length}`);

      // Если получено меньше batch size, значит это последняя страница
      if (batch.length < batchSize) {
        break;
      }

      // Небольшая пауза между запросами, чтобы не перегружать сервер
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (allBooks.length === 0) {
      return NextResponse.json({
        message: 'В базе данных нет книг для проверки',
        deletedCount: 0
      });
    }

    console.log(`✅ Всего получено книг: ${allBooks.length}`);

    // Группируем книги по автору и названию для поиска дубликатов
    const booksByAuthorTitle = new Map<string, typeof allBooks>();
    
    for (const book of allBooks) {
      // Пропускаем книги с пустыми названиями или авторами
      if (!book.title || !book.author) {
        continue;
      }
      const normalizedAuthor = normalizeBookText(book.author);
      const normalizedTitle = normalizeBookText(book.title);
      const key = `${normalizedAuthor}|${normalizedTitle}`;
      
      if (!booksByAuthorTitle.has(key)) {
        booksByAuthorTitle.set(key, []);
      }
      booksByAuthorTitle.get(key)?.push(book);
    }

    // Находим группы с более чем одной книгой (дубликаты)
    const duplicateGroups = Array.from(booksByAuthorTitle.entries())
      .filter(([_, books]) => books.length > 1)
      .map(([key, books]) => ({ 
        author: books[0].author, 
        title: books[0].title, 
        books 
      }));

    console.log(`\n📊 Найдено ${duplicateGroups.length} групп дубликатов книг:`);

    if (duplicateGroups.length === 0) {
      console.log('\n✅ Дубликатов не найдено');
      return NextResponse.json({
        message: 'Дубликатов не найдено',
        deletedCount: 0
      });
    }

    let totalDeleted = 0;
    let totalErrors = 0;
    const deletionResults = [];

    for (const group of duplicateGroups) {
      console.log(`\n📖 Обработка группы: "${group.author}" - "${group.title}"`);
      console.log(`  Найдено книг: ${group.books.length}`);
      
      // Выполняем удаление дубликатов в группе
      const result = await removeBookDuplicates(group.books);
      
      console.log(`  ${result.message}`);
      
      totalDeleted += result.deletedCount;
      deletionResults.push({
        author: group.author,
        title: group.title,
        result: result
      });
      
      if (result.message.includes('ошибок:')) {
        const errorMatch = result.message.match(/ошибок: (\d+)/);
        if (errorMatch) {
          totalErrors += parseInt(errorMatch[1]);
        }
      }
    }

    console.log(`\n✅ Удаление дубликатов завершено!`);
    console.log(`📊 Всего удалено: ${totalDeleted} книг`);
    if (totalErrors > 0) {
      console.log(`❌ Ошибок: ${totalErrors}`);
    }

    return NextResponse.json({
      message: `Удаление дубликатов завершено. Удалено: ${totalDeleted} книг`,
      deletedCount: totalDeleted,
      totalErrors,
      deletionResults
    });

  } catch (error) {
    console.error('❌ Ошибка при удалении дубликатов:', error);
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера', 
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      },
      { status: 500 }
    );
  }
}