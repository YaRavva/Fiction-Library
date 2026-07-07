import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function requireAdminRequest(request: Request) {
	const admin = getSupabaseAdmin();

	if (!admin) {
		return {
			error: NextResponse.json(
				{ error: "Supabase admin client is not configured" },
				{ status: 500 },
			),
		};
	}

	const authHeader = request.headers.get("authorization");
	const token = authHeader?.replace(/^Bearer\s+/i, "");

	if (!token) {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		};
	}

	const {
		data: { user },
		error: authError,
	} = await admin.auth.getUser(token);

	if (authError || !user) {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		};
	}

	const { data: profile, error: profileError } = await admin
		.from("user_profiles")
		.select("role")
		.eq("id", user.id)
		.single();

	const typedProfile = profile as { role?: string } | null;
	if (profileError || typedProfile?.role !== "admin") {
		return {
			error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		};
	}

	return { admin, user };
}
