const config = [
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        node: true,
        es2021: true,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];

module.exports = config;
