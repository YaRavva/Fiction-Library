#!/usr/bin/env tsx

/**
 * Скрипт автоматического обновления Memory Bank
 * Анализирует изменения в коде и обновляет соответствующие файлы документации
 *
 * Использование:
 * npx tsx scripts/update-memory-bank.ts
 * npx tsx scripts/update-memory-bank.ts --check-only  # только проверка без обновления
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface GitChange {
	type: "A" | "M" | "D" | "R"; // Added, Modified, Deleted, Renamed
	file: string;
}

interface MemoryBankUpdate {
	file: string;
	reason: string;
	changes: string[];
}

class MemoryBankUpdater {
	private readonly memoryBankPath = ".memory_bank";
	private readonly progressFile = join(this.memoryBankPath, "progress.md");
	private readonly systemPatternsFile = join(
		this.memoryBankPath,
		"systemPatterns.md",
	);
	private readonly techContextFile = join(
		this.memoryBankPath,
		"techContext.md",
	);
	private readonly activeContextFile = join(
		this.memoryBankPath,
		"activeContext.md",
	);

	/**
	 * Получает текущий Git хеш
	 */
	private getCurrentGitHash(): string {
		try {
			return execSync('git log -1 --format="%H"', { encoding: "utf-8" }).trim();
		} catch (error) {
			console.error("❌ Ошибка получения Git хеша:", error);
			return "";
		}
	}

	/**
	 * Получает последний проверенный хеш из progress.md
	 */
	private getLastCheckedHash(): string {
		try {
			if (!existsSync(this.progressFile)) {
				console.log("⚠️ Файл progress.md не найден");
				return "";
			}

			const content = readFileSync(this.progressFile, "utf-8");
			const match = content.match(/Last Checked Commit.*?`([a-f0-9]+)`/);
			return match ? match[1] : "";
		} catch (error) {
			console.error("❌ Ошибка чтения progress.md:", error);
			return "";
		}
	}

	/**
	 * Получает список изменений между коммитами
	 */
	private getGitChanges(fromHash: string, toHash: string): GitChange[] {
		try {
			if (!fromHash) {
				console.log("⚠️ Нет базового хеша, анализируем последние изменения");
				const output = execSync("git diff --name-status HEAD~1 HEAD", {
					encoding: "utf-8",
				});
				return this.parseGitOutput(output);
			}

			const output = execSync(`git diff --name-status ${fromHash} ${toHash}`, {
				encoding: "utf-8",
			});
			return this.parseGitOutput(output);
		} catch (error) {
			console.error("❌ Ошибка получения Git изменений:", error);
			return [];
		}
	}

	/**
	 * Парсит вывод git diff --name-status
	 */
	private parseGitOutput(output: string): GitChange[] {
		return output
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => {
				const [type, file] = line.split("\t");
				return { type: type as GitChange["type"], file };
			});
	}

	/**
	 * Анализирует изменения и определяет необходимые обновления Memory Bank
	 */
	private analyzeChanges(changes: GitChange[]): MemoryBankUpdate[] {
		const updates: MemoryBankUpdate[] = [];

		for (const change of changes) {
			// Изменения в package.json -> обновить techContext.md
			if (change.file === "package.json") {
				updates.push({
					file: this.techContextFile,
					reason: "Изменения в зависимостях проекта",
					changes: [`Обновлен package.json (${change.type})`],
				});
			}

			// Изменения в компонентах -> обновить systemPatterns.md
			if (
				change.file.startsWith("src/components/") &&
				change.file.endsWith(".tsx")
			) {
				updates.push({
					file: this.systemPatternsFile,
					reason: "Изменения в React компонентах",
					changes: [`${change.type}: ${change.file}`],
				});
			}

			// Изменения в сервисах -> обновить systemPatterns.md
			if (
				change.file.startsWith("src/lib/services/") &&
				change.file.endsWith(".ts")
			) {
				updates.push({
					file: this.systemPatternsFile,
					reason: "Изменения в бизнес-логике (Service Layer)",
					changes: [`${change.type}: ${change.file}`],
				});
			}

			// Изменения в API маршрутах -> обновить systemPatterns.md
			if (
				change.file.startsWith("src/app/api/") &&
				change.file.endsWith(".ts")
			) {
				updates.push({
					file: this.systemPatternsFile,
					reason: "Изменения в API маршрутах",
					changes: [`${change.type}: ${change.file}`],
				});
			}

			// Изменения в конфигурации -> обновить techContext.md
			if (change.file.match(/\.(config|json)$/)) {
				updates.push({
					file: this.techContextFile,
					reason: "Изменения в конфигурации проекта",
					changes: [`${change.type}: ${change.file}`],
				});
			}

			// Новые скрипты -> обновить techContext.md
			if (
				change.file.startsWith("scripts/") ||
				change.file.startsWith("src/scripts/")
			) {
				updates.push({
					file: this.techContextFile,
					reason: "Изменения в скриптах проекта",
					changes: [`${change.type}: ${change.file}`],
				});
			}
		}

		return this.consolidateUpdates(updates);
	}

	/**
	 * Консолидирует обновления по файлам
	 */
	private consolidateUpdates(updates: MemoryBankUpdate[]): MemoryBankUpdate[] {
		const consolidated = new Map<string, MemoryBankUpdate>();

		for (const update of updates) {
			if (consolidated.has(update.file)) {
				const existing = consolidated.get(update.file)!;
				existing.changes.push(...update.changes);
			} else {
				consolidated.set(update.file, update);
			}
		}

		return Array.from(consolidated.values());
	}

	/**
	 * Обновляет progress.md с новым хешем и информацией об изменениях
	 */
	private updateProgressFile(
		newHash: string,
		updates: MemoryBankUpdate[],
	): void {
		try {
			let content = readFileSync(this.progressFile, "utf-8");

			// Обновляем хеш
			content = content.replace(
				/Last Checked Commit.*?`[a-f0-9]+`/,
				`Last Checked Commit**: \`${newHash}\``,
			);

			// Обновляем дату
			const now = new Date().toISOString().split("T")[0];
			content = content.replace(
				/Last Checked Date.*?`[^`]+`/,
				`Last Checked Date**: \`${now}\``,
			);

			// Добавляем информацию об обновлениях, если есть
			if (updates.length > 0) {
				const updateInfo = updates
					.map((u) => `- ${u.reason}: ${u.changes.join(", ")}`)
					.join("\n");
				content = content.replace(
					/Status.*?✅[^\\n]*/,
					`Status**: ✅ Memory Bank обновлен автоматически\n\n**Последние изменения**:\n${updateInfo}`,
				);
			}

			writeFileSync(this.progressFile, content, "utf-8");
			console.log("✅ Обновлен progress.md");
		} catch (error) {
			console.error("❌ Ошибка обновления progress.md:", error);
		}
	}

	/**
	 * Обновляет activeContext.md с информацией о последних изменениях
	 */
	private updateActiveContext(updates: MemoryBankUpdate[]): void {
		try {
			let content = readFileSync(this.activeContextFile, "utf-8");

			// Обновляем дату
			const now = new Date().toISOString().replace("T", " ").substring(0, 16);
			content = content.replace(
				/Дата последнего обновления.*?\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}/,
				`Дата последнего обновления**: ${now}`,
			);

			// Добавляем информацию об автоматических изменениях
			if (updates.length > 0) {
				const changeInfo = updates.map((u) => `- ${u.reason}`).join("\n");
				const newSection = `\n\n### Автоматические обновления Memory Bank\n${changeInfo}\n`;

				// Добавляем перед разделом "Следующие Шаги"
				content = content.replace(
					/## Следующие Шаги/,
					`${newSection}## Следующие Шаги`,
				);
			}

			writeFileSync(this.activeContextFile, content, "utf-8");
			console.log("✅ Обновлен activeContext.md");
		} catch (error) {
			console.error("❌ Ошибка обновления activeContext.md:", error);
		}
	}

	/**
	 * Основной метод обновления Memory Bank
	 */
	public async updateMemoryBank(checkOnly: boolean = false): Promise<void> {
		console.log("🔍 Проверка изменений в репозитории...");

		const currentHash = this.getCurrentGitHash();
		const lastCheckedHash = this.getLastCheckedHash();

		if (!currentHash) {
			console.error("❌ Не удалось получить текущий Git хеш");
			return;
		}

		if (currentHash === lastCheckedHash) {
			console.log("✅ Изменений нет, Memory Bank актуален");
			return;
		}

		console.log(
			`📊 Анализ изменений: ${lastCheckedHash.substring(0, 8)} -> ${currentHash.substring(0, 8)}`,
		);

		const changes = this.getGitChanges(lastCheckedHash, currentHash);

		if (changes.length === 0) {
			console.log("✅ Изменений в отслеживаемых файлах не обнаружено");
			this.updateProgressFile(currentHash, []);
			return;
		}

		console.log(`📝 Обнаружено изменений: ${changes.length}`);
		changes.forEach((change) => {
			console.log(`  ${change.type}: ${change.file}`);
		});

		const updates = this.analyzeChanges(changes);

		if (updates.length === 0) {
			console.log("✅ Изменения не требуют обновления Memory Bank");
			this.updateProgressFile(currentHash, []);
			return;
		}

		console.log(
			`🔄 Требуется обновление файлов Memory Bank: ${updates.length}`,
		);
		updates.forEach((update) => {
			console.log(`  📄 ${update.file}: ${update.reason}`);
		});

		if (checkOnly) {
			console.log("🔍 Режим проверки: обновления не применены");
			return;
		}

		// Применяем обновления
		this.updateProgressFile(currentHash, updates);
		this.updateActiveContext(updates);

		console.log("✅ Memory Bank успешно обновлен!");
		console.log(
			"💡 Рекомендуется просмотреть изменения и при необходимости дополнить документацию вручную",
		);
	}
}

// Запуск скрипта
async function main() {
	const args = process.argv.slice(2);
	const checkOnly = args.includes("--check-only");

	const updater = new MemoryBankUpdater();
	await updater.updateMemoryBank(checkOnly);
}

if (require.main === module) {
	main().catch(console.error);
}
