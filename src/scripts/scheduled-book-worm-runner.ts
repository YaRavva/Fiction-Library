import { config } from 'dotenv';
import { resolve } from 'path';
import { spawn } from 'child_process';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

/**
 * Запускает "Книжного Червя" в режиме обновления
 */
async function runScheduledBookWorm() {
    console.log('⏰ Запланированный запуск Книжного Червя');
    console.log(`📅 Время запуска: ${new Date().toLocaleString('ru-RU')}`);
    
    try {
        // Запускаем скрипт "Книжного Червя" в режиме обновления
        const scriptPath = resolve(__dirname, 'run-book-worm.ts');
        const child = spawn('npx', ['tsx', scriptPath, 'update'], {
            cwd: process.cwd(),
            env: process.env,
            stdio: 'inherit'
        });
        
        // Обрабатываем завершение процесса
        child.on('close', (code) => {
            console.log(`🏁 Книжный Червь завершил выполнение с кодом: ${code}`);
        });
        
        // Обрабатываем ошибки
        child.on('error', (error) => {
            console.error('💥 Ошибка при запуске Книжного Червя:', error);
        });
    } catch (error) {
        console.error('💥 Ошибка при запуске запланированного Книжного Червя:', error);
    }
}

// Если скрипт запущен напрямую, начинаем выполнение
if (require.main === module) {
    runScheduledBookWorm().catch(console.error);
}

export { runScheduledBookWorm };