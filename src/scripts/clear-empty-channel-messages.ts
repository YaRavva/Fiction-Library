import { serverSupabase } from "./src/lib/serverSupabase";

async function clearEmptyChannelMessages() {
	console.log(
		"🗑️ Удаление записей из telegram_processed_messages с пустым значением channel...",
	);

	try {
		// Удаляем записи, где channel пустой или null
		const { data, error } = await serverSupabase
			.from("telegram_processed_messages")
			.delete()
			.or("channel.is.null,channel.eq.");

		if (error) {
			console.error("❌ Ошибка при удалении записей:", error);
			return;
		}

		console.log(
			`✅ Успешно удалено ${data?.length || 0} записей с пустым channel`,
		);
	} catch (error) {
		console.error("❌ Ошибка при выполнении запроса:", error);
	}
}

// Запускаем очистку
clearEmptyChannelMessages();
