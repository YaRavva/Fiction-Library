import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Логируем cookies для отладки
  console.log('Middleware cookies:', request.cookies.getAll().map(c => ({ name: c.name, value: c.value ? '[SET]' : '[EMPTY]' })))

  // Проверяем аутентификацию пользователя
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // Логируем для отладки
  console.log('Middleware auth check:', {
    hasUser: !!user,
    hasError: !!error,
    pathname: request.nextUrl.pathname,
    userId: user?.id
  })

  // Защищенные маршруты (требуют аутентификации)
  const protectedPaths = ['/library', '/profile', '/admin', '/reader']
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // Админские маршруты
  const adminPaths = ['/admin']
  const isAdminPath = adminPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // Если пользователь не авторизован и пытается попасть на защищенную страницу
  if ((!user || error) && isProtectedPath) {
    // Для путей аутентификации не перенаправляем, чтобы избежать зацикливания
    if (request.nextUrl.pathname.startsWith('/auth')) {
      return supabaseResponse
    }

    // Проверяем, является ли это OAuth колбэк
    if (request.nextUrl.pathname === '/auth/callback') {
      return supabaseResponse
    }

    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Проверяем права администратора для админских маршрутов
  if ((user && !error) && isAdminPath) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/access-denied'
      return NextResponse.redirect(url)
    }
  }

  // Перенаправляем с главной страницы в зависимости от статуса аутентификации
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    if (user && !error) {
      url.pathname = '/library'
    } else {
      url.pathname = '/auth/login'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}