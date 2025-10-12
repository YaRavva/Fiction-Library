import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/browserSupabase'
import { Icons } from "@/components/ui/icons"

export default function Home() {
  const router = useRouter()
  const supabase = getBrowserSupabase()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Пользователь авторизован, перенаправляем в библиотеку
        router.push('/library')
      } else {
        // Пользователь не авторизован, перенаправляем на страницу входа
        router.push('/auth/login')
      }
    }

    checkUser()
  }, [router, supabase])

  return (
    <div className="container flex h-screen w-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Icons.spinner className="h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Проверка авторизации...</p>
      </div>
    </div>
  )
}
