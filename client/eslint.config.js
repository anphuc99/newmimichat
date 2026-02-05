import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * ESLint configuration for the React client.
 *
 * @returns The ESLint flat config array.
 */
export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"]
  },
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react-refresh/only-export-components": "warn"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  }
];
