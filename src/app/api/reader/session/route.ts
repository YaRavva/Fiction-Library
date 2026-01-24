import { NextResponse } from "next/server";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";

export async function GET() {
	try {
		const supabase = getBrowserSupabase();
		const session = await getValidSession(supabase);

		if (!session) {
			return NextResponse.json({ error: "No valid session" }, { status: 401 });
		}

		return NextResponse.json({
			userId: session.user.id,
			userEmail: session.user.email,
		});
	} catch (error) {
		console.error("Error getting session:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
