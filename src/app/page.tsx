import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default function Home() {
  // Простое перенаправление на страницу логина
  redirect('/auth/login')
}
