import { putObject } from '../lib/s3-service';
import dotenv from 'dotenv';

dotenv.config();

async function testS3DirectUrl() {
  try {
    console.log('🚀 Начинаем тестирование прямых ссылок на S3...');
    
    // Создаем тестовый файл в памяти
    const testContent = `
Тестовый файл для проверки прямых ссылок на S3
============================================

Этот файл используется для тестирования загрузки файлов в S3 бакет
и проверки корректности формирования прямых ссылок на файлы.

Тестовая информация:
- Время создания: ${new Date().toISOString()}
- Имя файла: test-file.txt
- Формат: txt
    `.trim();
    
    const fileBuffer = Buffer.from(testContent, 'utf-8');
    const fileName = 'test-file.txt';
    
    // Загружаем файл в S3 бакет
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set.');
    }
    
    console.log(`📤 Загружаем тестовый файл в S3 бакет: ${bucketName}`);
    await putObject(fileName, fileBuffer, bucketName);
    console.log(`✅ Файл успешно загружен в S3: ${fileName}`);
    
    // Формируем прямой URL файла
    const fileUrl = `https://${bucketName}.s3.cloud.ru/${fileName}`;
    console.log(`🔗 Прямая ссылка на файл: ${fileUrl}`);
    
    // Проверяем доступность файла
    console.log('🔍 Проверяем доступность файла по прямой ссылке...');
    const response = await fetch(fileUrl);
    
    if (response.ok) {
      console.log('✅ Файл доступен по прямой ссылке');
      const content = await response.text();
      console.log('📄 Содержимое файла:');
      console.log(content);
    } else {
      console.error(`❌ Файл недоступен. Статус: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка в тестовом скрипте:', error);
  }
}

testS3DirectUrl();