import { redirect } from 'next/navigation'

export default function TestRedirectPage() {
  // Простое перенаправление на страницу логина
  redirect('/auth/login')
}