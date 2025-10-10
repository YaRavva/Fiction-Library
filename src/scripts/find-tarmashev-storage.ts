#!/usr/bin/env tsx

/**
 * Скрипт для поиска файлов Тармашева в хранилище
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function findTarmashevStorage() {
    console.log('🔍 Ищем файлы Тармашева в хранилище...\n');

    try {
        // Создаем клиент Supabase
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Пробуем получить файлы из разных бакетов
        const buckets = ['books', 'covers', 'files'];

        for (const bucket of buckets) {
            console.log(`\n📥 Проверяем бакет: ${bucket}`);
            try {
                const { data: bucketFiles, error } = await supabase.storage
                    .from(bucket)
                    .list('', { limit: 100 });

                if (error) {
                    console.log(`   ❌ Ошибка при доступе к бакету ${bucket}: ${error.message}`);
                    continue;
                }

                console.log(`   ✅ Найдено файлов: ${bucketFiles?.length || 0}`);

                if (bucketFiles && bucketFiles.length > 0) {
                    // Проверяем файлы на кириллицу
                    const cyrillicFiles = bucketFiles.filter(file =>
                        /[а-яё]/i.test(file.name)
                    );

                    if (cyrillicFiles.length > 0) {
                        console.log(`   🔤 Файлов с кириллицей в бакете ${bucket}: ${cyrillicFiles.length}`);
                        cyrillicFiles.slice(0, 5).forEach((file, index) => {
                            console.log(`     ${index + 1}. ${file.name}`);
                        });
                    }
                }
            } catch (bucketError) {
                console.log(`   ❌ Ошибка при проверке бакета ${bucket}: ${bucketError}`);
            }
        }

        // Получаем файлы из основного бакета для дальнейшего анализа
        const { data: files, error } = await supabase.storage
            .from('books')
            .list('', { limit: 1000 });

        if (error) {
            console.error('❌ Ошибка при получении файлов:', error);
            return;
        }

        console.log('✅ Файлы получены успешно');

        // Проверим несколько файлов на предмет кириллицы
        console.log('\n🔍 Проверяем файлы на кириллицу...');
        let cyrillicCount = 0;
        let nonAsciiCount = 0;

        files?.forEach((file, index) => {
            if (/[^\x00-\x7F]/.test(file.name)) {
                nonAsciiCount++;
                if (index < 5) { // Показываем только первые 5
                    console.log(`  ${index + 1}. ${file.name}`);
                }
            }
            if (/[а-яё]/i.test(file.name)) {
                cyrillicCount++;
            }
        });

        console.log(`📊 Результаты анализа:`);
        console.log(`   Файлов с не-ASCII символами: ${nonAsciiCount}`);
        console.log(`   Файлов с кириллицей: ${cyrillicCount}`);

        if (error) {
            console.error('❌ Ошибка при получении файлов:', error);
            return;
        }

        console.log(`📁 Всего файлов в хранилище: ${files?.length || 0}`);

        // Показываем все файлы для анализа (если их немного)
        if (files && files.length <= 20) {
            console.log('\n📋 Все файлы в хранилище:');
            files.forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);
            });
        } else {
            // Показываем случайные файлы для анализа
            console.log('\n📋 Случайные файлы из хранилища:');
            const indices = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
            indices.forEach(index => {
                if (files[index]) {
                    console.log(`${index + 1}. ${files[index].name}`);
                }
            });
        }

        // Ищем файлы с не-ASCII символами (могут содержать кириллицу)
        const nonAsciiFiles = files?.filter(file =>
            /[^\x00-\x7F]/.test(file.name)
        ) || [];

        console.log(`\n🔤 Файлы с не-ASCII символами: ${nonAsciiFiles.length}`);

        if (nonAsciiFiles.length > 0) {
            console.log('\n📚 Первые 20 файлов с не-ASCII символами:');
            nonAsciiFiles.slice(0, 20).forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);

                // Проверяем нормализацию Unicode
                const originalLength = file.name.length;
                const normalized = file.name.normalize('NFC');
                const normalizedLength = normalized.length;

                if (originalLength !== normalizedLength) {
                    console.log(`   🔧 Нормализация: ${originalLength} → ${normalizedLength} символов`);
                    console.log(`   ✅ Файл имеет проблемную кодировку!`);
                }
            });
        }

        // Ищем файлы, которые могут содержать кириллицу в другой кодировке
        const possibleCyrillicFiles = files?.filter(file => {
            const name = file.name.toLowerCase();
            // Ищем файлы, которые содержат паттерны, типичные для кириллических имен
            return name.includes('автор') ||
                   name.includes('книга') ||
                   name.includes('цикл') ||
                   name.includes('том') ||
                   name.includes('часть') ||
                   name.includes('глава');
        }) || [];

        console.log(`\n📖 Файлы с типичными кириллическими паттернами: ${possibleCyrillicFiles.length}`);

        if (possibleCyrillicFiles.length > 0) {
            console.log('\n📚 Первые 20 файлов с кириллическими паттернами:');
            possibleCyrillicFiles.slice(0, 20).forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);

                // Проверяем нормализацию Unicode
                const originalLength = file.name.length;
                const normalized = file.name.normalize('NFC');
                const normalizedLength = normalized.length;

                if (originalLength !== normalizedLength) {
                    console.log(`   🔧 Нормализация: ${originalLength} → ${normalizedLength} символов`);
                    console.log(`   ✅ Файл имеет проблемную кодировку!`);
                }
            });
        }

        // Ищем файлы с кириллицей (содержат символы кириллицы)
        const actualCyrillicFiles = files?.filter(file =>
            /[а-яё]/i.test(file.name)
        ) || [];

        console.log(`\n🔤 Файлы с не-ASCII символами: ${nonAsciiFiles.length}`);

        if (nonAsciiFiles.length > 0) {
            console.log('\n📚 Первые 20 файлов с не-ASCII символами:');
            nonAsciiFiles.slice(0, 20).forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);

                // Проверяем нормализацию Unicode
                const originalLength = file.name.length;
                const normalized = file.name.normalize('NFC');
                const normalizedLength = normalized.length;

                if (originalLength !== normalizedLength) {
                    console.log(`   🔧 Нормализация: ${originalLength} → ${normalizedLength} символов`);
                    console.log(`   ✅ Файл имеет проблемную кодировку!`);
                }
            });
        }

        // Ищем файлы с кириллицей (содержат символы кириллицы)
        const cyrillicFiles = files?.filter(file =>
            /[а-яё]/i.test(file.name)
        ) || [];

        console.log(`\n🔤 Файлы с кириллицей: ${cyrillicFiles.length}`);

        if (cyrillicFiles.length > 0) {
            console.log('\n📚 Первые 20 файлов с кириллицей:');
            cyrillicFiles.slice(0, 20).forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);

                // Проверяем нормализацию Unicode
                const originalLength = file.name.length;
                const normalized = file.name.normalize('NFC');
                const normalizedLength = normalized.length;

                if (originalLength !== normalizedLength) {
                    console.log(`   🔧 Нормализация: ${originalLength} → ${normalizedLength} символов`);
                    console.log(`   ✅ Файл имеет проблемную кодировку!`);
                }
            });
        }

        // Ищем файлы Тармашева (расширенный поиск)
        const tarmashevFiles = files?.filter(file => {
            const name = file.name.toLowerCase();
            return name.includes('тармашев') ||
                   name.includes('тarmaшев') ||
                   name.includes('тармашёв') ||
                   name.includes('tarmaшев') ||
                   name.includes('древн') ||
                   name.includes('древний') ||
                   name.includes('ancient');
        }) || [];

        console.log(`\n📚 Файлы Тармашева: ${tarmashevFiles.length}`);

        if (tarmashevFiles.length > 0) {
            tarmashevFiles.forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);
                console.log(`   Размер: ${file.metadata?.size || 'неизвестен'}`);
                console.log(`   Обновлен: ${file.updated_at}`);

                // Проверяем нормализацию Unicode
                const originalLength = file.name.length;
                const normalized = file.name.normalize('NFC');
                const normalizedLength = normalized.length;

                if (originalLength !== normalizedLength) {
                    console.log(`   🔧 Нормализация: ${originalLength} → ${normalizedLength} символов`);
                    console.log(`   ✅ Файл имеет проблемную кодировку!`);
                } else {
                    console.log(`   ✅ Кодировка корректная`);
                }
                console.log('');
            });
        }

        // Ищем конкретно файлы с "Древний"
        const ancientFiles = files?.filter(file => {
            const name = file.name.toLowerCase();
            return name.includes('древн') ||
                   name.includes('древний') ||
                   name.includes('древнии') ||
                   name.includes('древні') ||
                   name.includes('ancient');
        }) || [];

        console.log(`\n📖 Файлы с "Древний": ${ancientFiles.length}`);
        if (ancientFiles.length > 0) {
            ancientFiles.forEach((file, index) => {
                console.log(`${index + 1}. ${file.name}`);
            });
        }

    } catch (error) {
        console.error('❌ Ошибка при поиске файлов Тармашева:', error);
    }
}

// Запускаем поиск
findTarmashevStorage().catch((error) => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});