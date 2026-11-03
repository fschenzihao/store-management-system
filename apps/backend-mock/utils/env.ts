import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * 加载本地环境变量文件，供 CLI 脚本使用。
 *
 * - 不覆盖进程内已存在的环境变量，便于临时用命令行覆盖配置
 * - 先加载 `.env.local`，再加载 `.env`，保证本地配置优先级更高
 */
export function loadEnvFiles(): void {
  for (const file of ['.env.local', '.env']) {
    const filePath = path.resolve(process.cwd(), file);
    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }
}
