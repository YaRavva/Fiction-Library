// Загружаем переменные окружения
import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseAdmin } from '../lib/supabase';

async function checkBookExists() {
    console.log('Проверяем наличие книги в базе данных...\n');
    
    try {
        const admin = getSupabaseAdmin();
        if (!admin) {
            console.error('❌ Не удалось получить доступ к Supabase Admin');
            return;
        }
        
        // Проверяем наличие книги "цикл Мицелий" автора "Вилма Кадлечкова"
        console.log('Поиск книги: "цикл Мицелий" автора "Вилма Кадлечкова"');
        
        const { data: existingBook, error: fetchError } = await (admin as any)
            .from('books')
            .select('id, title, author')
            .eq('title', 'цикл Мицелий')
            .eq('author', 'Вилма Кадлечкова')
            .single();
        
        if (!fetchError && existingBook) {
            console.log(`✅ Книга найдена!`);
            console.log(`   ID: ${existingBook.id}`);
            console.log(`   Название: "${existingBook.title}"`);
            console.log(`   Автор: ${existingBook.author}`);
            return existingBook.id;
        } else {
            console.log(`⚠️ Книга не найдена`);
            if (fetchError) {
                console.log(`   Ошибка: ${fetchError.message}`);
            }
            
            // Проверим, есть ли вообще книги этого автора
            console.log('\nПроверяем наличие других книг автора "Вилма Кадлечкова":');
            const { data: authorBooks, error: authorError } = await (admin as any)
                .from('books')
                .select('id, title, author')
                .ilike('author', '%Вилма Кадлечкова%');
            
            if (!authorError && authorBooks && authorBooks.length > 0) {
                console.log(`Найдено ${authorBooks.length} книг автора:`);
                authorBooks.forEach((book: any) => {
                    console.log(`   - "${book.title}" (ID: ${book.id})`);
                });
            } else {
                console.log('Книг этого автора не найдено');
                if (authorError) {
                    console.log(`Ошибка: ${authorError.message}`);
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('❌ Ошибка при поиске книги:', error);
        return null;
    }
}

checkBookExists().catch(console.error);