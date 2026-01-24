import { serverSupabase } from "./src/lib/serverSupabase";

async function analyzeProcessedMessages() {
	console.log("🔍 Анализ записей в telegram_processed_messages...");

	try {
		// Считаем общее количество записей
		const { count: totalCount, error: totalError } = await serverSupabase
			.from("telegram_processed_messages")
			.select("*", { count: "exact", head: true });

		if (totalError) {
			console.error(
				"❌ Ошибка при подсчете общего количества записей:",
				totalError,
			);
			return;
		}

		console.log(`📊 Всего записей: ${totalCount}`);

		// Проверяем сообщения с пустым channel
		const { count: emptyChannelCount, error: emptyChannelError } =
			await serverSupabase
				.from("telegram_processed_messages")
				.select("*", { count: "exact", head: true })
				.or("channel.is.null,channel.eq.");

		if (emptyChannelError) {
			console.error(
				"❌ Ошибка при подсчете записей с пустым channel:",
				emptyChannelError,
			);
		} else {
			console.log(`📊 Записей с пустым channel: ${emptyChannelCount}`);
		}

		// Проверяем дубликаты по message_id
		const { data: duplicateCheck, error: duplicateError } = await serverSupabase
			.from("telegram_processed_messages")
			.select("message_id, channel, count(*)")
			.group("message_id, channel")
			.order("count", { ascending: false })
			.limit(10);

		if (duplicateError) {
			console.error("❌ Ошибка при проверке дубликатов:", duplicateError);
		} else {
			console.log("📈 Топ 10 повторяющихся комбинаций (message_id, channel):");
			duplicateCheck?.forEach((item: any, index: number) => {
				console.log(
					`   ${index + 1}. message_id: ${item.message_id}, channel: '${item.channel}', count: ${item.count}`,
				);
			});
		}

		// Проверим несколько случайных записей
		const { data: sampleRecords, error: sampleError } = await serverSupabase
			.from("telegram_processed_messages")
			.select("*")
			.limit(5);

		if (sampleError) {
			console.error("❌ Ошибка при получении образцов записей:", sampleError);
		} else {
			console.log("📋 Образцы записей:");
			sampleRecords?.forEach((record: any, index: number) => {
				console.log(
					`   ${index + 1}. message_id: ${record.message_id}, channel: '${record.channel || "NULL"}', book_id: ${record.book_id || "NULL"}, processed_at: ${record.processed_at}`,
				);
			});
		}
	} catch (error) {
		console.error("❌ Ошибка при выполнении анализа:", error);
	}
}

// Запускаем анализ
analyzeProcessedMessages();
