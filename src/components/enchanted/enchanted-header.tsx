'use client'

import { Search, User, LogOut, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  role: string
}

interface EnchantedHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  userProfile: UserProfile | null
  onLogout: () => void
}

export function EnchantedHeader({
  searchQuery,
  onSearchChange,
  userProfile,
  onLogout,
}: EnchantedHeaderProps) {
  return (
    <header className="relative border-b border-purple-500/20 backdrop-blur-sm bg-black/20">
      {/* Рунический орнамент сверху */}
      <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
        <svg className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="runeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9333ea" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#9333ea" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#runeGradient)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Логотип */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles className="w-8 h-8 text-amber-400" />
              <div className="absolute inset-0 blur-xl bg-amber-400/50 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-purple-400">
                Fiction Library
              </h1>
              <p className="text-xs text-purple-300 font-serif italic">Enchanted Edition</p>
            </div>
          </div>

          {/* Поиск */}
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-amber-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center bg-black/30 border border-purple-500/30 rounded-lg overflow-hidden">
                <Search className="w-5 h-5 text-purple-400 ml-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск в зачарованных книгах..."
                  className="w-full px-4 py-2.5 bg-transparent text-purple-100 placeholder-purple-400/60 focus:outline-none font-serif"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Пользователь */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-serif text-amber-200">
                {userProfile?.display_name || userProfile?.username || 'Путник'}
              </p>
              <p className="text-xs text-purple-400 capitalize">
                {userProfile?.role === 'admin' ? 'Хранитель' : 'Искатель'}
              </p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-amber-500/30 rounded-full blur-lg animate-pulse" />
              <Avatar className="relative h-10 w-10 border-2 border-amber-500/50 bg-black/50">
                <AvatarFallback className="bg-black/50 text-amber-400 font-serif">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg bg-black/30 border border-purple-500/30 text-purple-400 hover:text-amber-400 hover:border-amber-500/50 transition-all duration-300"
              title="Покинуть библиотеку"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Рунический орнамент снизу */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
    </header>
  )
}
