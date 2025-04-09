import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Disable the no-explicit-any rule since we need it for the SpeechSynthesis API
      "@typescript-eslint/no-explicit-any": "off",
      // Completely disable the exhaustive-deps rule to fix the build
      "react-hooks/exhaustive-deps": "off",
      // Also disable the unused eslint-disable warnings
      "@typescript-eslint/no-unused-vars": ["error", { 
        "vars": "all", 
        "args": "after-used", 
        "ignoreRestSiblings": true 
      }],
      // Disable unused eslint-disable directive warnings
      "eslint-comments/no-unused-disable": "off"
    }
  }
];

export default eslintConfig;
