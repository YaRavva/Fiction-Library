'use client'

import Link from "next/link"
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Icons } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBrowserSupabase } from '@/lib/browserSupabase'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const router = useRouter()
  const supabase = getBrowserSupabase()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })

      if (error) {
        throw error
      }

      setIsSent(true)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-1 lg:px-0">
      <Link
        href="/auth/login"
        className="absolute left-4 top-4 md:left-8 md:top-8 inline-flex items-center"
      >
        <Icons.chevronLeft className="mr-2 h-4 w-4" />
        Назад
      </Link>

      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Восстановление пароля
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSent 
              ? "Проверьте вашу почту для получения инструкций"
              : "Введите email для восстановления доступа"}
          </p>
        </div>

        {!isSent && (
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={isLoading}
                required
              />
            </div>
            <Button disabled={isLoading}>
              {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
              Отправить инструкции
            </Button>
          </form>
        )}

        {isSent && (
          <Button onClick={() => router.push('/auth/login')}>
            Вернуться на страницу входа
          </Button>
        )}
        </div>
      </div>
    </div>
  )
}