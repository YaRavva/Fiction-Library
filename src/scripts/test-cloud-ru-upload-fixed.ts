#!/usr/bin/env tsx

import 'dotenv/config';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  ListBucketsCommand
} from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';

async function testUploadToCloudRu() {
  console.log('=== Тестирование загрузки файлов в бакет Cloud.ru ===');
  
  // Проверка переменных окружения
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.S3_BUCKET_NAME) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'установлена' : 'отсутствует');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'установлена' : 'отсутствует');
    console.log('AWS_REGION:', process.env.AWS_REGION ? 'установлена' : 'отсутствует');
    console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME ? 'установлена' : 'отсутствует');
    return;
  }
  
  // Разбор ключа доступа для Cloud.ru
  // Формат: tenantId:keyId
  const accessKeyParts = process.env.AWS_ACCESS_KEY_ID.split(':');
  if (accessKeyParts.length !== 2) {
    console.error('❌ ОШИБКА: Неверный формат AWS_ACCESS_KEY_ID. Ожидается формат "tenantId:keyId"');
    return;
  }
  
  const [tenantId, keyId] = accessKeyParts;
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Key ID: ${keyId}`);
  
  // Создание S3 клиента с правильной конфигурацией для Cloud.ru
  const s3Client = new S3Client({
    endpoint: 'https://s3.cloud.ru',
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  
  const bucketName = process.env.S3_BUCKET_NAME;
  console.log(`Бакет: ${bucketName}`);
  console.log(`Регион: ${process.env.AWS_REGION}`);
  
  try {
    // 1. Проверка подключения - получение списка бакетов
    console.log('\n1. Проверка подключения - получение списка бакетов...');
    const listBucketsCommand = new ListBucketsCommand({});
    const listResponse = await s3Client.send(listBucketsCommand);
    console.log('✅ Список бакетов успешно получен');
    
    if (listResponse.Buckets) {
      console.log('Доступные бакеты:');
      listResponse.Buckets.forEach(bucket => {
        console.log(`  - ${bucket.Name} (создан: ${bucket.CreationDate})`);
      });
    }
    
    // 2. Тестовая загрузка файла
    console.log('\n2. Тестовая загрузка файла...');
    const testFileName = `test-upload-${Date.now()}.txt`;
    const testContent = Buffer.from('Тестовый файл для проверки загрузки в Cloud.ru S3\nДата: ' + new Date().toISOString(), 'utf-8');
    
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testFileName,
      Body: testContent,
      ContentType: 'text/plain',
    });
    
    const uploadResponse = await s3Client.send(putCommand);
    console.log('✅ Файл успешно загружен!');
    console.log('ETag:', uploadResponse.ETag);
    
    // 3. Попытка получить загруженный файл
    console.log('\n3. Проверка загруженного файла...');
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: testFileName,
    });
    
    const getResponse = await s3Client.send(getCommand);
    console.log('✅ Файл успешно получен!');
    
    // Преобразование содержимого файла в строку
    if (getResponse.Body) {
      const bodyContents = await streamToString(getResponse.Body);
      console.log('Содержимое файла:');
      console.log(bodyContents);
    }
    
    console.log('\n🎉 Все тесты пройдены успешно!');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    console.error('Код ошибки:', error.name);
    
    // Дополнительная информация об ошибке
    if (error.$metadata) {
      console.error('HTTP Status:', error.$metadata.httpStatusCode);
      console.error('Request ID:', error.$metadata.requestId);
    }
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Вспомогательная функция для преобразования ReadableStream в строку
async function streamToString(stream: any): Promise<string> {
  const chunks = [];
  
  if (stream instanceof ReadableStream) {
    const reader = stream.getReader();
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    // Преобразование Uint8Array в строку
    const decoder = new TextDecoder();
    return chunks.map(chunk => decoder.decode(chunk)).join('');
  } else if (typeof stream === 'object' && stream !== null) {
    // Для других типов потоков
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  } else {
    return String(stream);
  }
}

// Запуск теста
if (require.main === module) {
  testUploadToCloudRu()
    .then(() => {
      console.log('\n✅ Тест завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testUploadToCloudRu };