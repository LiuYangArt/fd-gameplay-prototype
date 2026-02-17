import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const TsFiles = ["packages/**/*.{ts,tsx}"];
const TsProjects = [
  "./packages/gameplay-core/tsconfig.json",
  "./packages/web-client/tsconfig.json",
  "./packages/ue-bridge/tsconfig.json"
];
const CoreLayerFiles = ["packages/gameplay-core/src/**/*.ts", "packages/ue-bridge/src/**/*.ts"];
const RestrictedBrowserGlobals = ["window", "document", "navigator"];
const RestrictedWebClientImportPatterns = [
  "@fd/web-client",
  "packages/web-client/*",
  "../web-client/*",
  "../../web-client/*"
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: TsFiles,
    languageOptions: {
      parserOptions: {
        project: TsProjects,
        noWarnOnMultipleProjects: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.es2024
      }
    },
    plugins: {
      import: importPlugin,
      "unused-imports": unusedImports
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: TsProjects
        }
      }
    },
    rules: {
      "no-duplicate-imports": "error",
      "import/no-duplicates": "error",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true
          }
        }
      ],
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true
        }
      ],
      complexity: ["error", 12],
      "max-depth": ["error", 4]
    }
  },
  {
    files: ["packages/web-client/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024
      }
    },
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      ...reactHooks.configs.recommended.rules
    }
  },
  {
    files: CoreLayerFiles,
    rules: {
      "no-restricted-globals": [
        "error",
        ...RestrictedBrowserGlobals.map((GlobalName) => ({
          name: GlobalName,
          message: "核心/UE 适配层禁止使用浏览器全局对象。"
        }))
      ],
      "no-restricted-properties": [
        "error",
        ...RestrictedBrowserGlobals.map((GlobalName) => ({
          object: "globalThis",
          property: GlobalName,
          message: "核心/UE 适配层禁止依赖浏览器环境。"
        }))
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: RestrictedWebClientImportPatterns,
              message: "核心/UE 适配层禁止依赖 web-client。"
            }
          ]
        }
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: ["class", "interface", "typeAlias", "enum"],
          format: ["PascalCase"],
          custom: {
            regex: "^[AUFEI][A-Za-z0-9]*$",
            match: true
          }
        },
        {
          selector: "typeParameter",
          format: ["PascalCase"],
          prefix: ["T"]
        }
      ]
    }
  },
  eslintConfigPrettier
];
