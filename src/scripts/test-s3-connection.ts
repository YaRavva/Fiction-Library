/**
 * Тест подключения к S3 (только чтение, ничего не удаляет)
 */
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
	endpoint: "https://s3.cloud.ru",
	region: process.env.AWS_REGION || "ru-central-1",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
	},
	forcePathStyle: true,
});

async function testConnection() {
	console.log("🔍 Тест подключения к S3 (только чтение)");
	console.log(`   Bucket: ${process.env.S3_BUCKET_NAME}`);
	console.log(`   Region: ${process.env.AWS_REGION}`);
	// Access key is not logged for security reasons

	try {
		const response = await s3Client.send(
			new ListObjectsV2Command({
				Bucket: process.env.S3_BUCKET_NAME,
				MaxKeys: 5,
			}),
		);

		console.log("\n✅ Подключение успешно!");
		console.log(`   Всего объектов: ${response.KeyCount}`);
		if (response.Contents) {
			console.log("   Первые 5 файлов:");
			for (const obj of response.Contents) {
				console.log(`   - ${obj.Key}`);
			}
		}
	} catch (error) {
		console.error("\n❌ Ошибка подключения:", error);
	}
}

testConnection();
