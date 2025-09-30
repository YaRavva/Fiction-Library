'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function LoginPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  // Handle search params on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setRedirectTo(params.get('redirectTo'))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push(redirectTo || '/library')
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(redirectTo || '/library')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router, redirectTo, loading])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
          <div className="mb-6">
            <Link 
              href="/"
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться на главную
            </Link>
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Вход в Fiction Library
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Войдите в свою учетную запись или создайте новую
            </p>
          </div>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#3b82f6',
                    brandAccent: '#2563eb',
                  },
                },
              },
              className: {
                container: 'auth-container',
                button: 'auth-button',
                input: 'auth-input',
              },
            }}
            localization={{
              variables: {
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Пароль',
                  button_label: 'Зарегистрироваться',
                  loading_button_label: 'Регистрация...',
                  social_provider_text: 'Войти через {{provider}}',
                  link_text: 'Нет аккаунта? Зарегистрируйтесь',
                },
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Пароль',
                  button_label: 'Войти',
                  loading_button_label: 'Вход...',
                  social_provider_text: 'Войти через {{provider}}',
                  link_text: 'Уже есть аккаунт? Войдите',
                },
                magic_link: {
                  email_input_label: 'Email',
                  button_label: 'Отправить ссылку',
                  loading_button_label: 'Отправка ссылки...',
                  link_text: 'Отправить магическую ссылку',
                },
                forgotten_password: {
                  email_label: 'Email',
                  password_label: 'Пароль',
                  button_label: 'Восстановить пароль',
                  loading_button_label: 'Отправка инструкций...',
                  link_text: 'Забыли пароль?',
                },
              },
            }}
            theme="default"
            providers={[]}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback'}
          />
        </div>
      </div>
    </div>
  )
}