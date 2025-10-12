import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // Обработка ошибок установки cookies
          }
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Пользователь авторизован, перенаправляем в библиотеку
    redirect('/library')
  } else {
    // Пользователь не авторизован, перенаправляем на страницу входа
    redirect('/auth/login')
  }
}