module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": "off",
    "no-undef": "off",
    indent: "off", // Let Prettier handle indentation
    "@stylistic/indent": "off", // Disable stylistic indent rule
    "no-mixed-spaces-and-tabs": "off", // Allow mixed indentation
  },
};
