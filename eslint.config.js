import js from '@eslint/js';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Intl: 'readonly',
  Math: 'readonly',
  Number: 'readonly',
  Array: 'readonly',
  Object: 'readonly',
  JSON: 'readonly',
  String: 'readonly',
  Error: 'readonly',
  isNaN: 'readonly',
  parseInt: 'readonly',
  parseFloat: 'readonly',
  HTMLElement: 'readonly',
  CustomEvent: 'readonly',
  structuredClone: 'readonly',
  localStorage: 'readonly',
  __DEMO__: 'readonly',
};

export default [
  {
    ignores: [
      'dist/**',
      'dist-demo/**',
      'android/**',
      'node_modules/**',
      '.npm-cache/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.js', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    // Electron main и конфиг сборщика — CommonJS с доступом к Node
    files: ['electron/**/*.cjs', 'electron-builder.config.cjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
      },
    },
  },
];
