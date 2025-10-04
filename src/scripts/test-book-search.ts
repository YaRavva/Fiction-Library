import { getSupabaseAdmin } from '../lib/supabase';

async function testBookSearch() {
    const admin = getSupabaseAdmin();
    
    if (!admin) {
        console.error('Не удалось получить доступ к Supabase Admin');
        return;
    }
    
    // Тестовые данные для поиска
    const testCases = [
        { author: "Вилма Кадлечкова", title: "цикл Мицелий" },
        { author: "Александр Беляев", title: "Человек-амфибия" },
        { author: "Айзек Азимов", title: "Основание" },
    ];
    
    console.log('Тестируем поиск книг в базе данных...\n');
    
    for (const testCase of testCases) {
        console.log(`Поиск книги: "${testCase.title}" автора ${testCase.author}`);
        
        try {
            const { data: existingBook, error: fetchError } = await (admin as any)
                .from('books')
                .select('id, title, author')
                .eq('title', testCase.title)
                .eq('author', testCase.author)
                .single();
            
            if (!fetchError && existingBook) {
                console.log(`  ✅ Найдена книга: ID=${existingBook.id}, "${existingBook.title}" автора ${existingBook.author}`);
            } else {
                console.log(`  ❌ Книга не найдена`);
                if (fetchError) {
                    console.log(`  Ошибка: ${fetchError.message}`);
                }
            }
        } catch (error) {
            console.error(`  ❌ Ошибка при поиске:`, error);
        }
        
        console.log('---');
    }
}

testBookSearch().catch(console.error);