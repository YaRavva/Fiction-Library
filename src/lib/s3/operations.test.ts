import { describe, expect, it, vi } from "vitest";
import { getS3AuthHeaders, getS3KeyFromReference } from "./operations";

vi.mock("./client", () => ({
	getS3Client: vi.fn(),
}));

describe("getS3AuthHeaders", () => {
	it("returns valid AWS4-HMAC-SHA256 authorization header", async () => {
		const headers = await getS3AuthHeaders({
			method: "GET",
			pathname: "/test-file.pdf",
			query: {},
			headers: { host: "s3.example.com" },
			payload: "",
			keyId: "test-key-id",
			keySecret: "test-secret",
			tenantId: "tenant-123",
			region: "ru-msk",
			service: "s3",
		});

		expect(headers.Authorization).toContain("AWS4-HMAC-SHA256");
		expect(headers.Authorization).toContain("tenant-123:test-key-id");
		expect(headers.Authorization).toContain("ru-msk");
		expect(headers["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/);
		expect(headers["x-amz-content-sha256"]).toBe("UNSIGNED-PAYLOAD");
		expect(headers.host).toBe("s3.example.com");
	});

	it("includes correct credential scope format", async () => {
		const headers = await getS3AuthHeaders({
			method: "PUT",
			pathname: "/upload/file.txt",
			query: {},
			headers: { host: "storage.cloud.ru" },
			payload: "data",
			keyId: "ak",
			keySecret: "sk",
			tenantId: "tid",
			region: "eu-west-1",
			service: "s3",
		});

		expect(headers.Authorization).toMatch(
			/Credential=tid:ak\/\d{8}\/eu-west-1\/s3\/aws4_request/,
		);
	});
});

describe("getS3KeyFromReference", () => {
	const bucket = "fiction-library";

	it("extracts keys from virtual-hosted URLs", () => {
		expect(
			getS3KeyFromReference(`https://${bucket}.s3.cloud.ru/2806.zip`, bucket),
		).toBe("2806.zip");
	});

	it("extracts keys from legacy path-style URLs", () => {
		expect(
			getS3KeyFromReference(`https://s3.cloud.ru/${bucket}/3382.zip`, bucket),
		).toBe("3382.zip");
	});

	it("extracts keys from storage paths", () => {
		expect(getS3KeyFromReference(`${bucket}/nested/book.fb2`, bucket)).toBe(
			"nested/book.fb2",
		);
	});
});
