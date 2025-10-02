'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/browserSupabase'
import { Icons } from "@/components/ui/icons"

export default function VerifyEmailPage() {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = getBrowserSupabase()

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Получаем токен из URL
        const token = searchParams.get('token')
        const type = searchParams.get('type')

        if (!token || type !== 'email') {
          setError('Неверная ссылка подтверждения')
          return
        }

        // Подтверждаем email
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email',
        })

        if (verifyError) {
          throw verifyError
        }

        // Перенаправляем в библиотеку
        router.push('/library')
      } catch (error) {
        console.error('Error:', error)
        setError('Ошибка подтверждения email')
      }
    }

    verifyEmail()
  }, [])

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col items-center space-y-4">
          {error ? (
            <>
              <Icons.alertCircle className="h-8 w-8 text-destructive" />
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Ошибка подтверждения
                </h1>
                <p className="text-sm text-muted-foreground">
                  {error}
                </p>
              </div>
            </>
          ) : (
            <>
              <Icons.spinner className="h-8 w-8 animate-spin" />
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Подтверждение email
                </h1>
                <p className="text-sm text-muted-foreground">
                  Пожалуйста, подождите...
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}