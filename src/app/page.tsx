import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Простое перенаправление на страницу логина
export default function Home() {
  redirect('/auth/login')
}
