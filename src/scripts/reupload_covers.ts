import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { TelegramService } from "../lib/telegram/client";

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

const coversBucket = process.env.S3_COVERS_BUCKET_NAME!;

async function reuploadCovers() {
	try {
		console.log(
			"🚀 Starting to re-upload covers with new naming convention...",
		);

		const telegramService = await TelegramService.getInstance();
		const metadataChannel = await telegramService.getMetadataChannel();
		// @ts-expect-error
		const messages = await telegramService.getAllMessages(metadataChannel.id);

		console.log(`Found ${messages.length} messages in the metadata channel.`);

		for (const message of messages) {
			// @ts-expect-error
			const messageId = message.id;
			// @ts-expect-error
			if (
				message.media &&
				(message.media.photo || message.media.webpage?.photo)
			) {
				try {
					console.log(`Processing message ${messageId}...`);
					// @ts-expect-error
					const photoBuffer = await telegramService.downloadMedia(message);

					if (photoBuffer) {
						const newFileName = `${messageId}.jpg`;
						console.log(`Uploading ${newFileName} to S3...`);

						await s3Client.send(
							new PutObjectCommand({
								Bucket: coversBucket,
								Key: newFileName,
								Body: photoBuffer,
								ContentType: "image/jpeg",
							}),
						);

						console.log(`✅ Successfully uploaded ${newFileName}`);
					}
				} catch (error) {
					console.error(`❌ Error processing message ${messageId}:`, error);
				}
			}
		}

		console.log("🎉 Cover re-upload process finished.");
	} catch (error) {
		console.error("❌ Error re-uploading covers:", error);
	} finally {
		const telegramService = await TelegramService.getInstance();
		await telegramService.disconnect();
	}
}

reuploadCovers();
