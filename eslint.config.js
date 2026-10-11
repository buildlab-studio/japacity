// @ts-check
// The purity rules for the simulation live here. Changing this file on a pull
// request needs the approved-test-change label (see tools/check-protected.ts).
import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// The lint fixtures pose as simulation files so a test can prove each rule
// fires. They are ignored by `pnpm lint` and linted only by that test.
const SIM_FILES = ["packages/sim/src/**/*.{ts,tsx}", "tools/lint-fixtures/sim/**/*.{ts,tsx}"];
const SIM_INT_FILE = ["packages/sim/src/engine/int.ts", "tools/lint-fixtures/sim/engine/int.ts"];
const CONTENT_FILES = ["packages/content/src/**/*.{ts,tsx}"];
const TEST_FILES = ["**/*.test.{ts,tsx}"];
const SIM_TEST_FILES = SIM_FILES.map((glob) => glob.replace("*.{ts,tsx}", "*.test.{ts,tsx}"));
const CONTENT_TEST_FILES = CONTENT_FILES.map((glob) => glob.replace("*.{ts,tsx}", "*.test.{ts,tsx}"));

const USE_INT_HELPERS = "Use the integer helpers in packages/sim/src/engine/int.ts.";
const PURE =
  "The simulation is pure: time, randomness and the outside world are passed in, never reached for.";

/** Builds a regex that matches any import source not in the allowed list. */
function importsOtherThan(/** @type {string[]} */ packages) {
  const allowed = [...packages.map((name) => `${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?:/|$)`), "\\.\\.?(?:/|$)"];
  return `^(?!${allowed.join("|")})`;
}

const TEST_LIBRARIES = ["vitest", "fast-check", "@fast-check/vitest"];

/** @param {string[]} packages @param {string} who */
function onlyImports(packages, who) {
  return [
    "error",
    {
      patterns: [
        {
          regex: importsOtherThan(packages),
          message: `${who} may import only ${packages.join(", ")} and its own relative files.`,
        },
      ],
    },
  ];
}

const DECIMAL_LITERAL = {
  // Matches 0.5, .5, 5., 1e3 and 1_000.5, but not hex such as 0xE1.
  selector: "Literal[raw=/^(?!0[xXbBoO])[0-9_]*[.eE]/]",
  message: `Decimal and exponent literals are banned: values are whole numbers of the smallest unit. ${USE_INT_HELPERS}`,
};

const DIVISION_AND_POWER = [
  { selector: "BinaryExpression[operator='/']", message: `The / operator is banned in the simulation. ${USE_INT_HELPERS}` },
  { selector: "AssignmentExpression[operator='/=']", message: `The /= operator is banned in the simulation. ${USE_INT_HELPERS}` },
  { selector: "BinaryExpression[operator='**']", message: `The ** operator is banned in the simulation. ${USE_INT_HELPERS}` },
  { selector: "AssignmentExpression[operator='**=']", message: `The **= operator is banned in the simulation. ${USE_INT_HELPERS}` },
];

const DYNAMIC_IMPORT = { selector: "ImportExpression", message: `Dynamic import is banned in the simulation. ${PURE}` };

const SIM_GLOBALS = [
  "Date",
  "performance",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "queueMicrotask",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "crypto",
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "process",
  "globalThis",
  "require",
  "console",
].map((name) => ({ name, message: PURE }));

const FLOAT_MATH = [
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "exp", "expm1", "log", "log2", "log10", "log1p", "pow", "sqrt", "cbrt", "hypot", "fround", "random",
  "E", "LN2", "LN10", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2",
].map((property) => ({
  object: "Math",
  property,
  message:
    property === "random"
      ? `Math.random is banned. Use the named random streams in the engine. ${PURE}`
      : "Floating-point maths can differ between browser and server. Allowed: floor ceil trunc round min max abs sign imul clz32.",
}));

export default defineConfig(
  globalIgnores([
    "**/.wrangler/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    // The docs are prose, except the documentation site's config, which is linted like any other code.
    "docs/**/*",
    "!docs/site/",
    "!docs/site/.vitepress/",
    "!docs/site/.vitepress/config.ts",
    "prototypes/**",
    "tools/lint-fixtures/**",
    "tools/__fixtures__/**",
  ]),

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      eqeqeq: ["error", "always"],
      "no-console": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Simulation: no clock, no own randomness, no I/O, no floating point.
  {
    files: SIM_FILES,
    rules: {
      "no-restricted-globals": ["error", { globals: SIM_GLOBALS, checkGlobalObject: true }],
      "no-restricted-properties": ["error", ...FLOAT_MATH],
      "no-restricted-syntax": ["error", DYNAMIC_IMPORT, DECIMAL_LITERAL, ...DIVISION_AND_POWER],
      "no-restricted-imports": onlyImports(["zod"], "The simulation"),
    },
  },
  {
    // The one file allowed to divide. Everything else calls its helpers.
    files: SIM_INT_FILE,
    rules: {
      "no-restricted-syntax": ["error", DYNAMIC_IMPORT],
    },
  },
  {
    files: SIM_TEST_FILES,
    rules: {
      // Rule tests play the real game data, so a simulation test may read content.
      "no-restricted-imports": onlyImports(["zod", "@japacity/content", ...TEST_LIBRARIES], "A simulation test"),
    },
  },

  // Content: plain data in whole numbers, built on the simulation's schemas.
  {
    files: CONTENT_FILES,
    rules: {
      "no-restricted-syntax": ["error", DECIMAL_LITERAL],
      "no-restricted-imports": onlyImports(["@japacity/sim", "zod"], "Content"),
    },
  },
  {
    files: CONTENT_TEST_FILES,
    rules: {
      "no-restricted-imports": onlyImports(["@japacity/sim", "zod", ...TEST_LIBRARIES], "A content test"),
    },
  },

  // Tests: never commit a focused, skipped or placeholder test.
  {
    files: TEST_FILES,
    plugins: { vitest },
    // @fast-check/vitest re-exports Vitest's test with a .prop extension.
    settings: { vitest: { vitestImports: ["@fast-check/vitest"] } },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-focused-tests": ["error", { fixable: false }],
      "vitest/no-disabled-tests": "error",
      "vitest/warn-todo": "error",
      "vitest/no-commented-out-tests": "error",
      "vitest/no-standalone-expect": ["error", { additionalTestBlockFunctions: ["test.prop", "it.prop"] }],
    },
  },
);
