// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { TelegramSyncService } from '../lib/telegram/sync';
import { getSupabaseAdmin, upsertBookRecord } from '../lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function createTestZipFile() {
    // Создаем простой тестовый ZIP файл
    const testContent = 'Это тестовый файл для проверки загрузки';
    const buffer = Buffer.from(testContent, 'utf-8');
    return buffer;
}

async function uploadTestFile() {
    console.log('=== ТЕСТ ЗАГРУЗКИ ФАЙЛА ===\n');
    
    try {
        // 1. Создаем тестовый файл
        console.log('1. Создаем тестовый ZIP файл...');
        const fileBuffer = await createTestZipFile();
        console.log(`   ✅ Создан файл размером ${fileBuffer.length} байт`);
        
        // 2. Имитируем сообщение Telegram с файлом
        const mockMessage: any = {
            id: 999999, // Тестовый ID сообщения
            document: {
                attributes: [
                    {
                        className: 'DocumentAttributeFilename',
                        fileName: 'Вилма Кадлечкова - Мицелий.zip'
                    }
                ]
            }
        };
        
        // 3. Извлекаем имя файла и метаданные
        let filenameCandidate = 'book_default.zip';
        if (mockMessage.document && mockMessage.document.attributes) {
            const attrFileName = mockMessage.document.attributes.find((attr: any) => 
                attr.className === 'DocumentAttributeFilename'
            );
            if (attrFileName && attrFileName.fileName) {
                filenameCandidate = attrFileName.fileName;
            }
        }
        
        console.log(`2. Имя файла: ${filenameCandidate}`);
        
        // 4. Извлекаем метаданные
        const metadata = TelegramSyncService.extractMetadataFromFilename(filenameCandidate);
        console.log(`3. Извлеченные метаданные:`);
        console.log(`   Автор: "${metadata.author}"`);
        console.log(`   Название: "${metadata.title}"`);
        
        // 5. Определяем параметры файла
        const ext = path.extname(filenameCandidate).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.fb2': 'application/fb2+xml',
            '.zip': 'application/zip',
        };
        const allowedFormats: Record<string, string> = {
            '.fb2': 'fb2',
            '.zip': 'zip',
        };
        
        const mime = mimeTypes[ext] || 'application/octet-stream';
        const fileFormat = allowedFormats[ext] || 'fb2';
        const storageKey = `${mockMessage.id}${ext}`;
        
        console.log(`4. Параметры файла:`);
        console.log(`   Формат: ${fileFormat}`);
        console.log(`   MIME-тип: ${mime}`);
        console.log(`   Ключ Storage: ${storageKey}`);
        
        // 6. Загружаем файл в Supabase Storage
        console.log(`5. Загружаем файл в Supabase Storage...`);
        const admin = getSupabaseAdmin();
        if (!admin) {
            throw new Error('Не удалось получить доступ к Supabase Admin');
        }
        
        const { data: uploadData, error: uploadError } = await admin.storage
            .from('books')
            .upload(storageKey, fileBuffer, {
                contentType: mime,
                upsert: true,
            });
        
        if (uploadError) {
            throw new Error(`Ошибка загрузки файла: ${uploadError.message}`);
        }
        
        console.log(`   ✅ Файл успешно загружен в Storage`);
        
        // 7. Формируем URL файла
        const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${encodeURIComponent(storageKey)}`;
        console.log(`6. URL файла: ${fileUrl}`);
        
        // 8. Создаем запись о файле и привязываем к книге
        console.log(`7. Привязываем файл к книге...`);
        const bookRecord: any = {
            title: metadata.title,
            author: metadata.author,
            file_url: fileUrl,
            file_size: fileBuffer.length,
            file_format: fileFormat,
            telegram_file_id: String(mockMessage.id),
            storage_path: storageKey,
            updated_at: new Date().toISOString()
        };
        
        const result = await upsertBookRecord(bookRecord);
        if (result) {
            console.log(`   ✅ Файл успешно привязан к книге!`);
            console.log(`   ID книги: ${result.id}`);
            console.log(`   Название: "${result.title}"`);
            console.log(`   Автор: ${result.author}`);
        } else {
            console.log(`   ⚠️  Книга не найдена, файл не привязан`);
            
            // Удаляем файл из Storage, если книга не найдена
            console.log(`   🗑️  Удаляем файл из Storage...`);
            await admin.storage.from('books').remove([storageKey]);
            console.log(`   ✅ Файл удален из Storage`);
        }
        
        console.log('\n=== ТЕСТ ЗАВЕРШЕН УСПЕШНО ===');
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
    }
}

uploadTestFile().catch(console.error);