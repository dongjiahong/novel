import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['mentor.08082025.xyz'], // Allows all hosts
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // 代码分割优化：将大型词典文件独立打包
        rollupOptions: {
          output: {
            // 手动配置代码分割策略
            manualChunks: (id) => {
              // 将词典文件分离到独立的 chunk
              if (id.includes('dicts/dict-small.js')) {
                return 'dict-small';
              }
              if (id.includes('dicts/dict-large.js')) {
                return 'dict-large';
              }
              // 将 node_modules 中的依赖分离
              if (id.includes('node_modules')) {
                return 'vendor';
              }
            },
            // 为静态资源设置长期缓存的文件名
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          }
        },
        // 调整 chunk 大小警告阈值（因为词典文件很大）
        chunkSizeWarningLimit: 2000, // 2MB
      }
    };
});
