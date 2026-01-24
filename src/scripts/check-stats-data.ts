// Simple script to check if there's data in the telegram_stats table
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

async function checkStatsData() {
	try {
		console.log("Checking telegram_stats table data...");

		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.SUPABASE_SERVICE_ROLE_KEY,
		);

		const { data, error } = await supabase
			.from("telegram_stats")
			.select("*")
			.limit(5);

		if (error) {
			console.error("Error querying table:", error);
			return;
		}

		console.log("Found", data.length, "records");
		if (data.length > 0) {
			console.log("Latest record:", data[0]);
		}
	} catch (error) {
		console.error("Script error:", error);
	}
}

checkStatsData();
