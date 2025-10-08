import { config } from 'dotenv';
import { resolve } from 'path';
import { rename, readdir, stat, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

async function renameFilesAndDirectories() {
    console.log('🔄 Переименование файлов и директорий...');
    
    // Переименовываем основные файлы
    const fileRenames = [
        { old: 'book-worm-service.ts', new: 'book-worm-service.ts' },
        { old: 'run-book-worm.ts', new: 'run-book-worm.ts' },
        { old: 'scheduled-book-worm.ts', new: 'scheduled-book-worm.ts' },
        { old: 'test-book-worm-logic.ts', new: 'test-book-worm-logic.ts' }
    ];
    
    for (const renameItem of fileRenames) {
        const oldPath = resolve(__dirname, `../lib/telegram/${renameItem.old}`);
        const newPath = resolve(__dirname, `../lib/telegram/${renameItem.new}`);
        
        try {
            // Проверяем, существует ли старый файл
            await stat(oldPath);
            await rename(oldPath, newPath);
            console.log(`✅ Переименован: ${renameItem.old} → ${renameItem.new}`);
        } catch (error) {
            console.log(`ℹ️  Файл не найден или уже переименован: ${renameItem.old}`);
        }
    }
    
    // Переименовываем скрипты
    const scriptRenames = [
        { old: 'run-book-worm.ts', new: 'run-book-worm.ts' },
        { old: 'scheduled-book-worm.ts', new: 'scheduled-book-worm.ts' },
        { old: 'test-book-worm-logic.ts', new: 'test-book-worm-logic.ts' }
    ];
    
    for (const renameItem of scriptRenames) {
        const oldPath = resolve(__dirname, renameItem.old);
        const newPath = resolve(__dirname, renameItem.new);
        
        try {
            // Проверяем, существует ли старый файл
            await stat(oldPath);
            await rename(oldPath, newPath);
            console.log(`✅ Переименован скрипт: ${renameItem.old} → ${renameItem.new}`);
        } catch (error) {
            console.log(`ℹ️  Скрипт не найден или уже переименован: ${renameItem.old}`);
        }
    }
    
    console.log('✅ Переименование файлов завершено');
}

async function updateFileContents() {
    console.log('🔄 Обновление содержимого файлов...');
    
    // Получаем все файлы в проекте
    async function getAllFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const items = await readdir(dir);
        
        for (const item of items) {
            const fullPath = join(dir, item);
            const stats = await stat(fullPath);
            
            if (stats.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
                files.push(...await getAllFiles(fullPath));
            } else if (stats.isFile() && (item.endsWith('.ts') || item.endsWith('.md') || item.endsWith('.json'))) {
                files.push(fullPath);
            }
        }
        
        return files;
    }
    
    const files = await getAllFiles(resolve(__dirname, '../../'));
    
    // Паттерны для замены
    const replacements = [
        { from: /Книжный Червь/g, to: 'Книжный Червь' },
        { from: /Книжного Червя/g, to: 'Книжного Червя' },
        { from: /Книжному Червю/g, to: 'Книжному Червю' },
        { from: /Книжным Червем/g, to: 'Книжным Червем' },
        { from: /Книжном Черве/g, to: 'Книжном Черве' },
        { from: /Book Worm/g, to: 'Book Worm' },
        { from: /book-worm/g, to: 'book-worm' },
        { from: /Book Worms/g, to: 'Book Worms' },
        { from: /book-worms/g, to: 'book-worms' }
    ];
    
    let updatedFiles = 0;
    
    for (const file of files) {
        try {
            const content = await readFile(file, 'utf-8');
            let newContent = content;
            let changed = false;
            
            for (const replacement of replacements) {
                if (replacement.from.test(newContent)) {
                    newContent = newContent.replace(replacement.from, replacement.to);
                    changed = true;
                }
            }
            
            if (changed) {
                await writeFile(file, newContent, 'utf-8');
                console.log(`✅ Обновлен файл: ${file}`);
                updatedFiles++;
            }
        } catch (error) {
            console.log(`⚠️  Ошибка при обновлении файла ${file}:`, error);
        }
    }
    
    console.log(`✅ Обновлено файлов: ${updatedFiles}`);
}

async function main() {
    console.log('🐋 Переименование "Книжный Червь" в "Книжный Червь"');
    console.log('==============================================');
    
    try {
        await renameFilesAndDirectories();
        await updateFileContents();
        
        console.log('\n🎉 Переименование завершено успешно!');
        console.log('Теперь сервис называется "Книжный Червь" (Book Worm)');
    } catch (error) {
        console.error('❌ Ошибка при переименовании:', error);
        process.exit(1);
    }
}

// Запуск скрипта
if (require.main === module) {
    main().catch(console.error);
}

export { renameFilesAndDirectories, updateFileContents };