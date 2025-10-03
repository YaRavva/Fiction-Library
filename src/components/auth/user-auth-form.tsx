"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/ui/icons"
import { useRouter } from "next/navigation"
import { getBrowserSupabase } from "@/lib/browserSupabase"
import { Toast } from "@/components/ui/toast"

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'login' | 'register'
}

export function UserAuthForm({
  className,
  type,
  ...props
}: UserAuthFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [email, setEmail] = React.useState<string>("")
  const [password, setPassword] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)
  const [toastMessage, setToastMessage] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({})

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setFieldErrors({})

    // Client-side validation
    const newFieldErrors: { email?: string; password?: string } = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newFieldErrors.email = 'Неверный формат email'
    }
    if (password.length < 6) {
      newFieldErrors.password = 'Пароль должен быть не меньше 6 символов'
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      setIsLoading(false)
      return
    }
    try {
      const client = getBrowserSupabase()

      if (type === 'login') {
        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          setToastMessage(signInError.message)
          return
        }

        // Успешный вход
        setToastMessage('Вход выполнен')
        router.push('/library')
      } else {
        // register
        const { error: signUpError } = await client.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          setError(signUpError.message)
          setToastMessage(signUpError.message)
          return
        }

        // При успешной регистрации можно направить на верификацию или на библиотеку
        setToastMessage('Регистрация прошла успешно')
        router.push('/library')
      }
    } catch (err: unknown) {
      const getErrorMessage = (e: unknown): string => {
        if (typeof e === 'string') return e
        if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
          return (e as { message: string }).message
        }
        try {
          return JSON.stringify(e)
        } catch {
          return String(e)
        }
      }

      setError(getErrorMessage(err) || 'Неизвестная ошибка')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email">
                Email
              </Label>
              {type === 'login' && (
                <Link
                  href="/auth/reset-password"
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                >
                  Забыли пароль?
                </Link>
              )}
            </div>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              placeholder="••••••••"
              type="password"
              autoCapitalize="none"
              autoComplete={type === 'register' ? 'new-password' : 'current-password'}
              autoCorrect="off"
              disabled={isLoading}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldErrors.password && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
            )}
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            {type === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </Button>
        </div>
      </form>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Или продолжить с
          </span>
        </div>
      </div>
      <Button variant="outline" type="button" disabled={isLoading}>
        {isLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.gitHub className="mr-2 h-4 w-4" />
        )}
        GitHub
      </Button>
    </div>
  )
}