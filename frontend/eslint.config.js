import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Platform rules (docs/08): keys come from event.key only; no native dialogs or GPS.
const platformProperties = [
  { property: 'keyCode', message: 'Use event.key (docs/08 §3).' },
  { property: 'which', message: 'Use event.key (docs/08 §3).' },
  { object: 'navigator', property: 'geolocation', message: 'No GPS (docs/08 §5).' },
]

// Layering rules (docs/04 §4.1).
const noStoreOrApi = [
  {
    group: ['@/store', '@/store/*', '**/store', '**/store/*'],
    message: 'components/ must not read the store.',
  },
  {
    group: ['@/api', '@/api/*', '**/api', '**/api/*'],
    message: 'components/ must not call the API.',
  },
]
const noDirectIo = (layer) => [
  { name: 'fetch', message: `${layer} must use api/ instead of fetch.` },
  { name: 'localStorage', message: `${layer} must use store/ instead of localStorage.` },
  { name: 'sessionStorage', message: `${layer} must use store/ instead of sessionStorage.` },
]
const noWindowIo = (layer) => [
  { object: 'window', property: 'fetch', message: `${layer} must use api/.` },
  { object: 'window', property: 'localStorage', message: `${layer} must use store/.` },
]

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'e2e/artifacts',
    'test-results',
    'playwright-report',
    'src/api/schema.d.ts',
  ]),
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    rules: {
      'no-alert': 'error',
      'no-restricted-properties': ['error', ...platformProperties],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: noStoreOrApi }],
      'no-restricted-globals': ['error', ...noDirectIo('components/')],
      'no-restricted-properties': ['error', ...platformProperties, ...noWindowIo('components/')],
    },
  },
  {
    files: ['src/screens/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...noDirectIo('screens/')],
      'no-restricted-properties': ['error', ...platformProperties, ...noWindowIo('screens/')],
    },
  },
  {
    files: ['src/keys/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/screens', '@/screens/*', '**/screens', '**/screens/*'],
              message: 'keys/ must not know any screen.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts', 'scripts/**/*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
])
