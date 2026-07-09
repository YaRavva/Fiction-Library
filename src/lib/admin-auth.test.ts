import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminRequest } from "./admin-auth";

vi.mock("./supabase", () => ({
	getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "./supabase";

function makeRequest(headers: Record<string, string> = {}) {
	return new Request("http://localhost/api/test", { headers });
}

describe("requireAdminRequest", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns error if Supabase admin client is not configured", async () => {
		vi.mocked(getSupabaseAdmin).mockReturnValue(null as any);
		const result = await requireAdminRequest(makeRequest());
		expect("error" in result).toBe(true);
		expect("error" in result && result.error).toBeInstanceOf(Response);
		const res = ("error" in result && result.error)!;
		expect(res.status).toBe(500);
	});

	it("returns 401 if no Authorization header", async () => {
		const mockAdmin = { auth: { getUser: vi.fn() } };
		vi.mocked(getSupabaseAdmin).mockReturnValue(mockAdmin as any);
		const result = await requireAdminRequest(makeRequest());
		expect("error" in result).toBe(true);
		const res = ("error" in result && result.error)!;
		expect(res.status).toBe(401);
	});

	it("returns 401 if token is invalid", async () => {
		const mockAdmin = {
			auth: {
				getUser: vi.fn().mockResolvedValue({
					data: { user: null },
					error: { message: "bad" },
				}),
			},
		};
		vi.mocked(getSupabaseAdmin).mockReturnValue(mockAdmin as any);
		const result = await requireAdminRequest(
			makeRequest({ authorization: "Bearer invalid-token" }),
		);
		expect("error" in result).toBe(true);
		const res = ("error" in result && result.error)!;
		expect(res.status).toBe(401);
	});

	it("returns 403 if user is not admin", async () => {
		const mockAdmin = {
			auth: {
				getUser: vi.fn().mockResolvedValue({
					data: { user: { id: "user-1" } },
					error: null,
				}),
			},
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						single: vi.fn().mockResolvedValue({
							data: { role: "user" },
							error: null,
						}),
					}),
				}),
			}),
		};
		vi.mocked(getSupabaseAdmin).mockReturnValue(mockAdmin as any);
		const result = await requireAdminRequest(
			makeRequest({ authorization: "Bearer valid-token" }),
		);
		expect("error" in result).toBe(true);
		const res = ("error" in result && result.error)!;
		expect(res.status).toBe(403);
	});

	it("returns admin client and user for valid admin", async () => {
		const mockUser = { id: "admin-1" };
		const mockAdmin = {
			auth: {
				getUser: vi.fn().mockResolvedValue({
					data: { user: mockUser },
					error: null,
				}),
			},
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						single: vi.fn().mockResolvedValue({
							data: { role: "admin" },
							error: null,
						}),
					}),
				}),
			}),
		};
		vi.mocked(getSupabaseAdmin).mockReturnValue(mockAdmin as any);
		const result = await requireAdminRequest(
			makeRequest({ authorization: "Bearer valid-token" }),
		);
		expect("error" in result).toBe(false);
		if (!("error" in result)) {
			expect(result.user).toEqual(mockUser);
			expect(result.admin).toBe(mockAdmin);
		}
	});
});
