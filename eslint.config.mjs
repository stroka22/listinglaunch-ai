export default [
  {
    files: ["**/*.{js,jsx,mjs,cjs}", "eslint.config.mjs"],
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    rules: {},
  },
];
