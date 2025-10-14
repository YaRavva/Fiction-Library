'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/browserSupabase'
import { getValidSession } from '@/lib/auth-helpers'
import { Book } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Menu, BookOpen, Download } from 'lucide-react'
import JSZip from 'jszip'

export const dynamic = 'force-dynamic'

function ReaderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookId = searchParams.get('bookId')
  
  const [supabase] = useState(() => getBrowserSupabase())
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<string>('')
  const [files, setFiles] = useState<{name: string, content: string}[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showFileSelector, setShowFileSelector] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Загрузка книги и файла
  useEffect(() => {
    const loadData = async () => {
      if (!bookId) {
        router.push('/library')
        return
      }
      
      try {
        // Получаем сессию
        const session = await getValidSession(supabase)
        if (!session) {
          router.push('/auth/login')
          return
        }
        
        // Получаем информацию о книге
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select('*')
          .eq('id', bookId)
          .single()
        
        if (bookError) {
          console.error('Error loading book:', bookError)
          router.push('/library')
          return
        }
        
        setBook(bookData)
        
        // Проверяем формат файла
        if (bookData.file_format === 'zip') {
          // Для архивов показываем выбор файлов
          await loadZipContent(bookData.file_url || '')
        } else {
          // Для одиночных файлов загружаем содержимое
          await loadFileContent(bookData.file_url || '')
        }
        
        // Увеличиваем счетчик просмотров
        await incrementViews(bookId)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [bookId, supabase, router])
  
  // Загрузка содержимого одиночного файла
  const loadFileContent = async (fileUrl: string) => {
    try {
      // Проверяем, является ли файл из Cloud.ru S3
      let downloadUrl = fileUrl;
      if (fileUrl && fileUrl.includes('s3.cloud.ru')) {
        // Используем проксирующий endpoint для Cloud.ru S3
        const fileName = book?.storage_path || fileUrl.split('/').pop() || 'file';
        downloadUrl = `/api/cloud-ru-proxy?fileName=${encodeURIComponent(fileName)}`;
      }
      
      const response = await fetch(downloadUrl);
      const text = await response.text();
      setContent(text);
    } catch (error) {
      console.error('Error loading file content:', error);
    }
  }
  
  // Загрузка содержимого архива
  const loadZipContent = async (fileUrl: string) => {
    try {
      // Проверяем, является ли файл из Cloud.ru S3
      let downloadUrl = fileUrl;
      if (fileUrl && fileUrl.includes('s3.cloud.ru')) {
        // Используем проксирующий endpoint для Cloud.ru S3
        const fileName = book?.storage_path || fileUrl.split('/').pop() || 'file.zip';
        downloadUrl = `/api/cloud-ru-proxy?fileName=${encodeURIComponent(fileName)}`;
      }
      
      const response = await fetch(downloadUrl);
      const arrayBuffer = await response.arrayBuffer();
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(arrayBuffer)
      
      const fileContents: {name: string, content: string}[] = []
      const filePromises: Promise<void>[] = []
      
      zipContent.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
        // Игнорируем директории и служебные файлы macOS
        if (!zipEntry.dir && 
            (relativePath.endsWith('.fb2') || relativePath.endsWith('.txt')) &&
            !relativePath.startsWith('__MACOSX/') &&
            !relativePath.includes('/._')) {
          filePromises.push(
            zipEntry.async('text').then((content: string) => {
              fileContents.push({ name: relativePath, content })
            })
          )
        }
      })
      
      await Promise.all(filePromises)
      setFiles(fileContents)
      
      // Если в архиве только один файл, открываем его сразу
      if (fileContents.length === 1) {
        setSelectedFile(fileContents[0].name)
        setContent(fileContents[0].content)
      } else if (fileContents.length > 1) {
        // Если несколько файлов, показываем выбор
        setShowFileSelector(true)
      }
    } catch (error) {
      console.error('Error loading ZIP content:', error)
    }
  }
  
  // Увеличение счетчика просмотров
  const incrementViews = async (bookId: string) => {
    try {
      await supabase.rpc('increment_views', { book_id: bookId })
    } catch (error) {
      console.error('Error incrementing views:', error)
    }
  }
  
  // Выбор файла из архива
  const handleFileSelect = (fileName: string) => {
    const file = files.find(f => f.name === fileName)
    if (file) {
      setSelectedFile(fileName)
      setContent(file.content)
      setShowFileSelector(false)
    }
  }
  
  // Увеличение размера шрифта
  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 24))
  }
  
  // Уменьшение размера шрифта
  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 12))
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Загрузка читалки...</p>
        </div>
      </div>
    )
  }
  
  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Книга не найдена</p>
          <Button onClick={() => router.push('/library')}>Вернуться в библиотеку</Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push('/library')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold truncate max-w-xs sm:max-w-md">{book.title}</h1>
              <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">{book.author}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={decreaseFontSize}>
              <span className="text-xs">A-</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={increaseFontSize}>
              <span className="text-lg">A+</span>
            </Button>
            {book.file_url && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  if (book.file_url) {
                    // Create a custom filename in the format "author - title.ext"
                    const sanitizedTitle = book.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                    const sanitizedAuthor = book.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                    const fileExtension = book.file_format && book.file_format !== '' ? 
                      book.file_format : 
                      (book.storage_path ? book.storage_path.split('.').pop() : 'fb2')
                    const filename = `${sanitizedAuthor} - ${sanitizedTitle}.${fileExtension}`
                    
                    // Проверяем, является ли файл из Cloud.ru S3
                    let downloadUrl = book.file_url;
                    if (book.file_url && book.file_url.includes('s3.cloud.ru')) {
                      // Используем проксирующий endpoint для Cloud.ru S3
                      const fileName = book.storage_path || book.file_url.split('/').pop() || filename;
                      downloadUrl = `/api/cloud-ru-proxy?fileName=${encodeURIComponent(fileName)}`;
                    }
                    
                    // Fetch the file and trigger download with custom filename
                    fetch(downloadUrl)
                      .then(response => response.blob())
                      .then(blob => {
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = filename
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        window.URL.revokeObjectURL(url)
                      })
                      .catch(error => {
                        console.error('Error downloading file:', error)
                        // Fallback to opening in new tab if download fails
                        window.open(downloadUrl, '_blank')
                      })
                  }
                }}
              >
                <Download className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowFileSelector(!showFileSelector)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* File Selector */}
      {showFileSelector && files.length > 1 && (
        <div className="border-b bg-background p-4">
          <h2 className="text-lg font-semibold mb-2">Выберите файл для чтения</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {files.map((file) => (
              <Button
                key={file.name}
                variant={selectedFile === file.name ? "default" : "outline"}
                className="justify-start truncate"
                onClick={() => handleFileSelect(file.name)}
              >
                {file.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {/* Reader Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {content ? (
          <div 
            className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
            style={{ fontSize: `${fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Содержимое книги недоступно</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReaderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Загрузка читалки...</p>
        </div>
      </div>
    }>
      <ReaderContent />
    </Suspense>
  )
}