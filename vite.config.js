import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';

  return {
    // относительные пути обязательны: в APK и в установленном приложении
    // страница грузится из файла, абсолютные пути там ломаются
    base: './',
    define: {
      // демо-сборка помечается флагом: плашка и отключённая отправка заявок
      __DEMO__: JSON.stringify(isDemo),
    },
    build: {
      outDir: isDemo ? 'dist-demo' : 'dist',
      emptyOutDir: true,
      target: 'es2020',
    },
    server: {
      port: 5173,
      host: true,
    },
    test: {
      include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
      environment: 'node',
      // forks-пул поднимает дочерние процессы: в ограниченных песочницах Windows
      // это падает с EPERM, потоки работают везде
      pool: 'threads',
      reporters: 'default',
    },
  };
});
