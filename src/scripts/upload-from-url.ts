import 'dotenv/config';
import { uploadFile } from '../lib/cloud-ru-s3-service';

async function downloadFile() {
  const fileUrl = 'https://ygqyswivvdtpgpnxrpzl.supabase.co/storage/v1/object/public/books/1050.zip';
  const bucketName = 'books';
  const fileName = '1050.zip';
  
  try {
    console.log('Начинаю скачивание файла...');
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Ошибка при скачивании: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log(`Файл успешно скачан. Размер: ${fileSize} байт`);
    
    // Преобразуем ArrayBuffer в Buffer для загрузки в S3
    const fileBuffer = Buffer.from(arrayBuffer);
    
    // Загружаем файл в S3-хранилище
    await uploadFile(bucketName, fileName, fileBuffer);
    console.log(`Файл ${fileName} успешно загружен в бакет ${bucketName} на cloud.ru`);
    
  } catch (error) {
    console.error('Ошибка при скачивании или загрузке файла:', error);
  }
}

// Вызов функции для выполнения скачивания и загрузки
downloadFile();