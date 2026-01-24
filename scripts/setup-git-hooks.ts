#!/usr/bin/env tsx

/**
 * Скрипт настройки Git hooks для автоматического обновления Memory Bank
 *
 * Использование:
 * npx tsx scripts/setup-git-hooks.ts
 */

import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

class GitHooksSetup {
	private readonly hooksDir = ".git/hooks";

	/**
	 * Создает post-commit hook для автоматического обновления Memory Bank
	 */
	private createPostCommitHook(): void {
		const hookPath = join(this.hooksDir, "post-commit");

		const hookContent = `#!/bin/sh
#
# Git post-commit hook для автоматического обновления Memory Bank
# Создан автоматически скриптом setup-git-hooks.ts
#

echo "🔄 Проверка необходимости обновления Memory Bank..."

# Проверяем, есть ли Node.js и tsx
if ! command -v npx &> /dev/null; then
    echo "⚠️ npx не найден, пропускаем обновление Memory Bank"
    exit 0
fi

# Запускаем обновление Memory Bank
if [ -f "scripts/update-memory-bank.ts" ]; then
    echo "📝 Обновление Memory Bank..."
    npx tsx scripts/update-memory-bank.ts
    
    # Если были изменения в Memory Bank, добавляем их в следующий коммит
    if [ -n "$(git status --porcelain .memory_bank/)" ]; then
        echo "📋 Обнаружены изменения в Memory Bank"
        echo "💡 Рекомендуется проверить изменения и закоммитить их:"
        echo "   git add .memory_bank/"
        echo "   git commit -m 'docs: автоматическое обновление Memory Bank'"
    fi
else
    echo "⚠️ Скрипт update-memory-bank.ts не найден"
fi

echo "✅ Post-commit hook завершен"
`;

		try {
			writeFileSync(hookPath, hookContent, "utf-8");
			chmodSync(hookPath, 0o755); // Делаем файл исполняемым
			console.log("✅ Создан post-commit hook:", hookPath);
		} catch (error) {
			console.error("❌ Ошибка создания post-commit hook:", error);
		}
	}

	/**
	 * Создает pre-push hook для проверки актуальности Memory Bank
	 */
	private createPrePushHook(): void {
		const hookPath = join(this.hooksDir, "pre-push");

		const hookContent = `#!/bin/sh
#
# Git pre-push hook для проверки актуальности Memory Bank
# Создан автоматически скриптом setup-git-hooks.ts
#

echo "🔍 Проверка актуальности Memory Bank перед push..."

# Проверяем, есть ли Node.js и tsx
if ! command -v npx &> /dev/null; then
    echo "⚠️ npx не найден, пропускаем проверку Memory Bank"
    exit 0
fi

# Запускаем проверку Memory Bank
if [ -f "scripts/update-memory-bank.ts" ]; then
    npx tsx scripts/update-memory-bank.ts --check-only
    
    if [ $? -ne 0 ]; then
        echo "❌ Memory Bank не синхронизирован с кодом"
        echo "💡 Запустите обновление: npx tsx scripts/update-memory-bank.ts"
        echo "🚫 Push отменен"
        exit 1
    fi
else
    echo "⚠️ Скрипт update-memory-bank.ts не найден"
fi

echo "✅ Memory Bank актуален"
`;

		try {
			writeFileSync(hookPath, hookContent, "utf-8");
			chmodSync(hookPath, 0o755); // Делаем файл исполняемым
			console.log("✅ Создан pre-push hook:", hookPath);
		} catch (error) {
			console.error("❌ Ошибка создания pre-push hook:", error);
		}
	}

	/**
	 * Основной метод настройки hooks
	 */
	public setupHooks(): void {
		console.log("🔧 Настройка Git hooks для Memory Bank...");

		// Проверяем, что мы в Git репозитории
		if (!existsSync(".git")) {
			console.error(
				"❌ Не найден .git директория. Убедитесь, что вы в корне Git репозитория.",
			);
			return;
		}

		// Создаем директорию hooks, если её нет
		if (!existsSync(this.hooksDir)) {
			mkdirSync(this.hooksDir, { recursive: true });
			console.log("📁 Создана директория hooks");
		}

		// Создаем hooks
		this.createPostCommitHook();
		this.createPrePushHook();

		console.log("✅ Git hooks успешно настроены!");
		console.log("");
		console.log("📋 Настроенные hooks:");
		console.log(
			"  • post-commit: автоматическое обновление Memory Bank после коммита",
		);
		console.log("  • pre-push: проверка актуальности Memory Bank перед push");
		console.log("");
		console.log("💡 Для ручного обновления Memory Bank используйте:");
		console.log("   npx tsx scripts/update-memory-bank.ts");
	}
}

// Запуск скрипта
function main() {
	const setup = new GitHooksSetup();
	setup.setupHooks();
}

if (require.main === module) {
	main();
}
