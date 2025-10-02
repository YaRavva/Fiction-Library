'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Icons } from "@/components/ui/icons"

export default function AuthCallback() {
  const router = useRouter()
  const supabase = getBrowserSupabase()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth/login')
          return
        }

        if (data?.session) {
          // Успешная аутентификация
          router.push('/library')
        } else {
          // Нет сессии, перенаправляем на страницу входа
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Unexpected auth callback error:', error)
        router.push('/auth/login')
      }
    }

    handleAuthCallback()
  }, [router, supabase])

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center items-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col items-center space-y-4">
          <Icons.spinner className="h-8 w-8 animate-spin" />
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Подтверждение входа
            </h1>
            <p className="text-sm text-muted-foreground">
              Пожалуйста, подождите...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}