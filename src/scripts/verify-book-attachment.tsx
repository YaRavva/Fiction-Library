// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseAdmin } from '../lib/supabase';

async function verifyBookAttachment() {
    console.log('=== ПРОВЕРКА ПРИВЯЗКИ ФАЙЛА К КНИГЕ ===\n');
    
    try {
        // Получаем доступ к Supabase
        const admin = getSupabaseAdmin();
        if (!admin) {
            console.error('❌ Не удалось получить доступ к Supabase Admin');
            return;
        }
        
        // Проверяем книгу с ID f419281e-4f7e-4515-a4f7-7594f2685a1d
        const bookId = 'f419281e-4f7e-4515-a4f7-7594f2685a1d';
        console.log(`1. Проверка книги с ID: ${bookId}`);
        
        const { data: book, error: bookError } = await (admin as any)
            .from('books')
            .select('title, author, file_url, file_size, file_format, telegram_file_id, storage_path')
            .eq('id', bookId)
            .single();
        
        if (bookError || !book) {
            console.log(`   ❌ Книга не найдена: ${bookError?.message || 'Неизвестная ошибка'}`);
            return;
        }
        
        console.log(`   ✅ Книга найдена:`);
        console.log(`      Название: "${book.title}"`);
        console.log(`      Автор: ${book.author}`);
        console.log(`      Формат файла: ${book.file_format}`);
        console.log(`      Размер файла: ${book.file_size} байт`);
        console.log(`      Telegram file ID: ${book.telegram_file_id}`);
        console.log(`      Storage path: ${book.storage_path}`);
        console.log(`      File URL: ${book.file_url}`);
        
        // Проверяем, что файл действительно существует в Storage
        if (book.storage_path) {
            console.log(`\n2. Проверка наличия файла в Storage...`);
            try {
                const { data: fileData, error: fileError } = await admin.storage
                    .from('books')
                    .download(book.storage_path);
                
                if (fileError) {
                    console.log(`   ❌ Ошибка при проверке файла: ${fileError.message}`);
                } else if (fileData) {
                    console.log(`   ✅ Файл найден в Storage`);
                    console.log(`      Размер: ${fileData.size} байт`);
                } else {
                    console.log(`   ⚠️  Файл не найден или пуст`);
                }
            } catch (storageError) {
                console.log(`   ❌ Ошибка при проверке Storage: ${storageError}`);
            }
        }
        
        console.log('\n=== ПРОВЕРКА ЗАВЕРШЕНА ===');
        
    } catch (error) {
        console.error('❌ Ошибка при проверке:', error);
    }
}

verifyBookAttachment().catch(console.error);