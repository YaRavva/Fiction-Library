import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const detailedS3Test = async () => {
  console.log("=== Подробная диагностика S3 ===");
  
  // Проверка переменных окружения
  const accessKeyId = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.NEXT_PUBLIC_AWS_REGION || process.env.AWS_REGION;
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
  
  console.log("NEXT_PUBLIC_AWS_ACCESS_KEY_ID:", process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID ? "установлена" : "НЕТ");
  console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "установлена" : "НЕТ");
  console.log("accessKeyId (фактически используется):", accessKeyId ? "установлена" : "НЕТ");
  console.log("Регион:", region || "НЕТ");
  console.log("Bucket:", bucketName || "НЕТ");
  
  if (!accessKeyId || !secretAccessKey || !region || !bucketName) {
    console.log("Ошибка: Не все переменные окружения установлены");
    return;
  }
  
  // Проверка формата ключей
  console.log("Формат accessKeyId:", accessKeyId.length, "символов");
  console.log("Формат secretAccessKey:", secretAccessKey.length, "символов");
  
  try {
    console.log("Создание S3 клиента...");
    const s3Client = new S3Client({
      endpoint: "https://s3.cloud.ru",
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      }
    });
    
    console.log("Клиент создан успешно");
    
    // Подготовка тестового файла
    const filePath = path.join(__dirname, "detailed-test-file.txt");
    const fileContent = "Hello, S3 from TypeScript! Detailed test.";
    fs.writeFileSync(filePath, fileContent);
    
    const fileBuffer = fs.readFileSync(filePath);
    const key = `detailed-test-upload-${Date.now()}.txt`;
    
    console.log("Попытка загрузки файла...");
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer
    });
    
    const result = await s3Client.send(command);
    console.log("✅ Объект успешно загружен с ключом:", key);
    console.log("Метаданные ответа:", result.$metadata);
    
    fs.unlinkSync(filePath); // Удаление тестового файла
    console.log("✅ Тест загрузки в S3 завершен успешно");
  } catch (error) {
    console.error("❌ Ошибка при работе с S3:", error);
    if (error instanceof Error) {
      console.error("Имя ошибки:", error.name);
      console.error("Сообщение ошибки:", error.message);
    }
  }
};

detailedS3Test();