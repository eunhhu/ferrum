import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import solid from "eslint-plugin-solid";

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      solid: solid,
    },
    rules: {
      // TypeScript rules - relaxed for development
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off", // Allow any during development
      "@typescript-eslint/no-non-null-assertion": "off", // Allow ! operator
      "@typescript-eslint/no-unused-vars": "off",

      // Solid rules - warnings only
      "solid/reactivity": "warn",
      "solid/no-destructure": "warn",
      "solid/jsx-no-undef": "error",
      "solid/prefer-for": "off", // Allow both For and map

      // General rules - relaxed
      "no-console": "off", // Allow console.log during development
      "no-debugger": "warn",
      "prefer-const": "warn",
      "no-var": "error",
      "eqeqeq": "off", // Allow == for convenience
      "curly": "off", // Allow single-line if statements
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "src-tauri/**",
      "crates/**",
      "*.config.js",
      "*.config.ts",
      "src/__tests__/**", // Ignore test files
      "src/test/**",
    ],
  },
];
