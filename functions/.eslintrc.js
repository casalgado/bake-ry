module.exports = {
    root: true,
    env: {
      node: true,
      browser: true,
    },
    extends: [
      'eslint:recommended',
    ],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // Add your formatting rules here as well
    }
  };