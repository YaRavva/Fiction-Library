'use client'

import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import type { Session } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { UserAuthForm } from "@/components/auth/user-auth-form"
import { Icons } from "@/components/ui/icons"

export const dynamic = 'force-dynamic'

function LoginContent() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    setRedirectTo(searchParams.get('redirectTo'))
  }, [searchParams])

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push(redirectTo || '/library')
      } else {
        setLoading(false)
      }
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(redirectTo || '/library')
      }
    })

    return () => subscription.unsubscribe()
  }, [redirectTo, router, supabase])

  if (loading) {
    return (
      <div className="container flex h-screen w-screen items-center justify-center">
        <Icons.spinner className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <Icons.reader className="mr-2 h-6 w-6" />
          Fiction Library
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Книги - это уникальный способ жить тысячу жизней... или читать одну книгу тысячу раз.&rdquo;
            </p>
            <footer className="text-sm">Бенджамин Франклин</footer>
          </blockquote>
        </div>
      </div>
      
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Добро пожаловать
            </h1>
            <p className="text-sm text-muted-foreground">
              Войдите в свой аккаунт для доступа к библиотеке
            </p>
          </div>

          <UserAuthForm type="login" />

          <p className="px-8 text-center text-sm text-muted-foreground">
            <Link
              href="/auth/register"
              className="hover:text-primary underline underline-offset-4"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="container flex h-screen w-screen items-center justify-center">
        <Icons.spinner className="h-6 w-6 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}