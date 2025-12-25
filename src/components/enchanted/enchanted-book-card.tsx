'use client'

import { useState } from 'react'
import Image from 'next/image'
import { BookOpen, Download, Sparkles } from 'lucide-react'
import { Book } from '@/lib/supabase'

interface EnchantedBookCardProps {
  book: Book & {
    series?: {
      id: string
      title: string
      author: string
      series_composition?: { title: string; year: number }[]
      cover_urls?: string[]
    }
  }
  onDownload: (book: Book) => void
  onRead: (book: Book) => void
}

export function EnchantedBookCard({ book, onDownload, onRead }: EnchantedBookCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const coverUrl = book.series?.cover_urls?.[0] || book.cover_url
  const hasFile = !!book.file_url

  return (
    <div
      className="group relative"
      style={{ perspective: '1000px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Магическое свечение при наведении */}
      <div
        className={`absolute -inset-1 bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 rounded-lg blur-lg opacity-0 transition-all duration-700 ${
          isHovered ? 'opacity-50' : ''
        }`}
      />

      {/* 3D книга */}
      <div
        className={`relative bg-gradient-to-br from-slate-900/95 to-purple-950/95 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-700 ${
          isHovered ? 'shadow-2xl shadow-purple-500/20' : 'shadow-xl'
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isHovered ? 'rotateY(-5deg) rotateX(5deg) translateY(-10px)' : 'rotateY(0) rotateX(0)',
        }}
      >
        {/* Орнаментальная рамка */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9333ea" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#9333ea" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" fill="none" stroke="url(#borderGradient)" strokeWidth="2" rx="8" />
          </svg>
        </div>

        {/* Угловые орнаменты */}
        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-amber-500/40" />
        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-amber-500/40" />
        <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-amber-500/40" />
        <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-amber-500/40" />

        {/* Обложка книги */}
        <div className="relative aspect-[2/3] overflow-hidden">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={book.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-amber-900/30 flex items-center justify-center">
              <Sparkles className="w-16 h-16 text-purple-400/50" />
            </div>
          )}

          {/* Градиентный оверлей */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />

          {/* Информация о книге */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-lg font-serif text-amber-100 font-semibold leading-tight mb-1 line-clamp-2">
              {book.title}
            </h3>
            <p className="text-sm font-serif text-purple-300 italic mb-2">{book.author}</p>

            {/* Рейтинг */}
            {book.rating && book.rating > 0 && (
              <div className="flex items-center gap-1 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-serif text-amber-300">{book.rating.toFixed(1)}</span>
              </div>
            )}

            {/* Жанры */}
            {book.genres && book.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {book.genres.slice(0, 3).map((genre, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-200 font-serif"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="relative p-3 flex gap-2">
          {hasFile && (
            <>
              <button
                onClick={() => onRead(book)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-purple-600/80 to-purple-700/80 hover:from-purple-500/90 hover:to-purple-600/90 text-white rounded-lg border border-purple-400/30 transition-all duration-300 font-serif text-sm group/btn"
              >
                <BookOpen className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                <span>Читать</span>
              </button>
              <button
                onClick={() => onDownload(book)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-amber-600/80 to-amber-700/80 hover:from-amber-500/90 hover:to-amber-600/90 text-white rounded-lg border border-amber-400/30 transition-all duration-300 font-serif text-sm group/btn"
              >
                <Download className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                <span>Скачать</span>
              </button>
            </>
          )}
          {!hasFile && (
            <div className="w-full py-2 text-center text-purple-400/60 text-sm font-serif italic">
              Файл не найден
            </div>
          )}
        </div>

        {/* Магические частицы на карточке */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-amber-400 rounded-full animate-pulse"
              style={{
                left: `${20 + i * 30}%`,
                top: `${30 + i * 15}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${2 + i}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
