import { TelegramSyncService } from '../lib/telegram/sync';
import { getSupabaseAdmin } from '../lib/supabase';

async function testFullWorkflow() {
    console.log('Тестируем полный рабочий процесс...\n');
    
    // Тестовое имя файла
    const filename = 'Вилма Кадлечкова - Мицелий.zip';
    console.log(`1. Имя файла: ${filename}`);
    
    // Извлекаем метаданные
    const metadata = TelegramSyncService.extractMetadataFromFilename(filename);
    console.log(`2. Извлеченные метаданные:`);
    console.log(`   Автор: "${metadata.author}"`);
    console.log(`   Название: "${metadata.title}"`);
    
    // Проверяем наличие книги в базе данных
    console.log(`3. Поиск книги в базе данных...`);
    
    const admin = getSupabaseAdmin();
    if (!admin) {
        console.error('   ❌ Не удалось получить доступ к Supabase Admin');
        return;
    }
    
    try {
        const { data: existingBook, error: fetchError } = await (admin as any)
            .from('books')
            .select('id, title, author')
            .eq('title', metadata.title)
            .eq('author', metadata.author)
            .single();
        
        if (!fetchError && existingBook) {
            console.log(`   ✅ Найдена книга в базе данных:`);
            console.log(`      ID: ${existingBook.id}`);
            console.log(`      Название: "${existingBook.title}"`);
            console.log(`      Автор: ${existingBook.author}`);
            
            // Имитируем создание записи о файле
            console.log(`4. Имитация привязки файла к книге...`);
            console.log(`   ✅ Файл успешно привязан к книге`);
        } else {
            console.log(`   ⚠️  Книга не найдена в базе данных`);
            if (fetchError) {
                console.log(`      Ошибка: ${fetchError.message}`);
            }
            console.log(`   ℹ️  В реальной ситуации файл не будет загружен в Storage`);
        }
    } catch (error) {
        console.error(`   ❌ Ошибка при поиске книги:`, error);
    }
    
    console.log('\n---\n');
    console.log('Тест завершен успешно!');
}

testFullWorkflow().catch(console.error);