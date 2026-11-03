import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineNitroConfig } from 'nitropack/config';

import errorHandler from './error';

process.env.COMPATIBILITY_DATE = new Date().toISOString();

/**
 * 数据库路径规范化：默认值与相对路径统一按本包根（apps/backend-mock）解析。
 *
 * vite dev 的 nitro-mock 插件以 apps/web-ele 为 cwd 启动本包，若按启动进程
 * cwd 解析相对路径，会打开一个空库导致业务接口报 no such table。
 */
const packageRoot = fileURLToPath(new URL('.', import.meta.url));
if (!process.env.DATABASE_PATH) {
  process.env.DATABASE_PATH = path.join(packageRoot, 'data', 'store.db');
} else if (!path.isAbsolute(process.env.DATABASE_PATH)) {
  process.env.DATABASE_PATH = path.resolve(
    packageRoot,
    process.env.DATABASE_PATH,
  );
}
export default defineNitroConfig({
  devErrorHandler: errorHandler,
  errorHandler: '~/error',
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers':
          'Accept, Authorization, Content-Length, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-CSRF-TOKEN, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': '*',
      },
    },
  },
});
