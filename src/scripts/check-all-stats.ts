// Check all records in telegram_stats table
require("dotenv").config();

async function checkAllStats() {
	try {
		console.log("Checking all records in telegram_stats table...");

		const { createClient } = require("@supabase/supabase-js");

		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.SUPABASE_SERVICE_ROLE_KEY,
		);

		const { data, error } = await supabase
			.from("telegram_stats")
			.select("*")
			.order("updated_at", { ascending: false });

		if (error) {
			console.error("Error fetching stats:", error);
			return;
		}

		console.log(`Found ${data.length} records:`);
		data.forEach((record: any, index: number) => {
			console.log(`${index + 1}.`, record);
		});
	} catch (error) {
		console.error("Test error:", error);
	}
}

checkAllStats();
