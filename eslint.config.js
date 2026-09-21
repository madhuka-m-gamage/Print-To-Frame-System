import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'no-empty': 'off',
      'no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['tests/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Import style: outside its own folder, code under src/ imports with the @/ alias, and tests
  // import app code through @/ too. (firebase-applet-config.json sits outside src, so it stays relative.)
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^\\.\\./(?!(?:\\.\\./)*firebase-applet-config\\.json$)',
          message: 'Use the @/ alias instead of a parent-folder import.',
        }],
      }],
    },
  },
  {
    files: ['tests/unit/**/*.{js,jsx}', 'tests/component/**/*.{js,jsx}', 'tests/api/**/*.{js,jsx}', 'tests/integration/**/*.{js,jsx}', 'tests/helpers/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^\\.{1,2}/(?:.*/)?src/',
          message: 'Import app code with the @/ alias (for example @/utils/toast), not a relative path into src.',
        }],
      }],
    },
  },
];
