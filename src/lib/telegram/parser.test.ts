import { describe, it, expect } from "vitest";
import { parseMessage, MetadataParser } from "./parser";

const sampleMessage = `
Название: Мастер и Маргарита
Автор: Булгаков М.А.
Жанр: #классика #философия #фантасстика
Рейтинг: 4.8
Описание шикарное произведение о добре и зле.

Состав:
1. Мастер и Маргарита (1966)
2. Москва - Петушки (1968)

#книга #рекомендую
`;

describe("parseMessage", () => {
	it("parses full message with all fields", () => {
		const result = parseMessage(sampleMessage);
		expect(result.title).toBe("Мастер и Маргарита");
		expect(result.author).toBe("Булгаков М.А.");
		expect(result.rating).toBe(4.8);
		expect(result.genres).toContain("классика");
		expect(result.genres).toContain("философия");
		expect(result.tags).toContain("книга");
		expect(result.tags).toContain("рекомендую");
		expect(result.books).toHaveLength(2);
		expect(result.books[0].title).toBe("Мастер и Маргарита");
		expect(result.books[0].year).toBe(1966);
	});

	it("parses message with no composition", () => {
		const text = `
Название: Простая книга
Автор: Иванов И.И.
Жанр: #роман
Рейтинг: 3.5
Описание короткое описание.
`;
		const result = parseMessage(text);
		expect(result.title).toBe("Простая книга");
		expect(result.author).toBe("Иванов И.И.");
		expect(result.books).toHaveLength(0);
		expect(result.series).toBeUndefined();
	});

	it("returns empty values for empty text", () => {
		const result = parseMessage("");
		expect(result.title).toBe("");
		expect(result.author).toBe("");
		expect(result.genres).toEqual([]);
		expect(result.tags).toEqual([]);
		expect(result.rating).toBe(0);
	});

	it("handles comma in rating", () => {
		const text = `
Название: Книга
Автор: Писатель
Рейтинг: 4,5
`;
		const result = parseMessage(text);
		expect(result.rating).toBe(4.5);
	});
});

describe("MetadataParser extract functions", () => {
	it("extractAuthor extracts author from text", () => {
		expect(MetadataParser.extractAuthor("Автор: Толстой Л.Н.")).toBe(
			"Толстой Л.Н.",
		);
		expect(MetadataParser.extractAuthor("no author here")).toBe("");
	});

	it("extractTitle extracts title from text", () => {
		expect(MetadataParser.extractTitle("Название: Война и мир")).toBe(
			"Война и мир",
		);
	});

	it("extractRating parses decimal rating", () => {
		expect(MetadataParser.extractRating("Рейтинг: 4.9")).toBe(4.9);
		expect(MetadataParser.extractRating("no rating")).toBe(0);
	});

	it("extractGenres parses hashtag genres", () => {
		const genres = MetadataParser.extractGenres("Жанр: #фантастика #приключения");
		expect(genres).toContain("фантастика");
		expect(genres).toContain("приключения");
	});

	it("extractTags parses all hashtags", () => {
		const tags = MetadataParser.extractTags("Text #tag1 #tag2");
		expect(tags).toContain("tag1");
		expect(tags).toContain("tag2");
	});

	it("extractBooks parses composition list", () => {
		const text = "Состав:\n1. Книга первая (2020)\n2. Книга вторая (2021)";
		const books = MetadataParser.extractBooks(text);
		expect(books).toHaveLength(2);
		expect(books[0]).toEqual({ title: "Книга первая", year: 2020 });
		expect(books[1]).toEqual({ title: "Книга вторая", year: 2021 });
	});
});
