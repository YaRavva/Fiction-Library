import "dotenv/config";

console.log("Проверка переменных окружения для S3:");
console.log("NEXT_PUBLIC_AWS_ACCESS_KEY_ID:", process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID ? "установлена" : "НЕТ");
console.log("NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY:", process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY ? "установлена" : "НЕТ");
console.log("NEXT_PUBLIC_AWS_REGION:", process.env.NEXT_PUBLIC_AWS_REGION || "НЕТ");
console.log("NEXT_PUBLIC_S3_BUCKET_NAME:", process.env.NEXT_PUBLIC_S3_BUCKET_NAME || "НЕТ");
console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "установлена" : "НЕТ");
console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "установлена" : "НЕТ");
console.log("AWS_REGION:", process.env.AWS_REGION || "НЕТ");
console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME || "НЕТ");