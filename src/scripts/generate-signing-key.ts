import { createSigningKey } from '../lib/cloud-ru-s3-service';
import dotenv from 'dotenv';

// Загружаем переменные окружения из файла .env
dotenv.config();

async function generateSigningKey() {
  // Читаем AWS_SECRET_ACCESS_KEY из переменных окружения
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!secretKey) {
    console.error('Ошибка: AWS_SECRET_ACCESS_KEY не найден в переменных окружения');
    process.exit(1);
  }
  
  // Устанавливаем дату в 20251014
  const date = '20251014';
  
  try {
    // Вызываем функцию createSigningKey с полученным ключом и датой
    const signingKey = await createSigningKey(secretKey, date);
    
    // Преобразуем ArrayBuffer в шестнадцатеричную строку
    const signingKeyArray = Array.from(new Uint8Array(signingKey));
    const signingKeyHex = signingKeyArray
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    // Выводим результат в консоль
    console.log(signingKeyHex);
  } catch (error) {
    console.error('Ошибка при генерации SigningKey:', error);
    process.exit(1);
  }
}

// Выполняем функцию
generateSigningKey();