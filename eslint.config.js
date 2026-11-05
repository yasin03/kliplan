import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "cikti", "out", "build", "coverage", "web/.next", "web/next-env.d.ts", "web/components/ui"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Müşteri ayrımı: web kodu ofise bağlı veriye yalnızca veri katmanından (`depoAl`) erişir.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@cekirdek/db/*", "drizzle-orm", "drizzle-orm/*"],
              message: "Veritabanına doğrudan erişmeyin; girisGerekli() ile gelen depo'yu kullanın.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["web/lib/auth.ts"],
    rules: { "no-restricted-imports": "off" },
  },
);
