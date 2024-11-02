const globals = require('globals');
const pluginJs = require('@eslint/js');
const pluginVue = require('eslint-plugin-vue');
const pluginJest = require('eslint-plugin-jest');

module.exports = [
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    ignores: ['node_modules/**', 'dist/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Disable problematic rules
      'no-unused-vars': ['off', { 'args': 'none' }],
      'no-undef': 'off',

      // Basic formatting
      'semi': ['error', 'always'],
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'comma-dangle': ['error', 'always-multiline'],

      // Spacing
      'array-bracket-spacing': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'space-before-blocks': ['error', 'always'],
      'space-before-function-paren': ['error', {
        'anonymous': 'always',
        'named': 'never',
        'asyncArrow': 'always',
      }],
      'space-in-parens': ['error', 'never'],
      'space-infix-ops': 'error',
      'key-spacing': ['error', {
        'beforeColon': false,
        'afterColon': true,
      }],
      'keyword-spacing': ['error', {
        'before': true,
        'after': true,
      }],

      // Line breaks
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0 }],
      'eol-last': ['error', 'always'],
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js', '**/__tests__/**/*.js'],
    plugins: {
      jest: pluginJest,
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...pluginJest.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  pluginJs.configs.recommended,
  ...pluginVue.configs['flat/essential'],
];
