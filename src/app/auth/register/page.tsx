'use client'

import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import type { Session } from '@supabase/supabase-js'
import { UserAuthForm } from "@/components/auth/user-auth-form"
import { Icons } from "@/components/ui/icons"

export default function RegisterPage() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    setRedirectTo(searchParams.get('redirectTo'))
    setLoading(false)
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
    } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(redirectTo || '/library')
      }
    })

    return () => subscription.unsubscribe()
  }, [loading])

  if (loading) {
    return (
      <div className="container flex h-screen w-screen items-center justify-center">
        <Icons.spinner className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-1 lg:px-0">
      <Link
        href="/"
        className="absolute left-4 top-4 md:left-8 md:top-8 inline-flex items-center"
      >
        <Icons.chevronLeft className="mr-2 h-4 w-4" />
        На главную
      </Link>

      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Создать аккаунт
          </h1>
          <p className="text-sm text-muted-foreground">
            Зарегистрируйтесь для доступа к библиотеке
          </p>
        </div>

        <UserAuthForm type="register" />

        <p className="px-8 text-center text-sm text-muted-foreground">
          <Link 
            href="/auth/login"
            className="hover:text-primary underline underline-offset-4"
          >
            Уже есть аккаунт? Войти
          </Link>
        </p>
        </div>
      </div>
    </div>
  )
}