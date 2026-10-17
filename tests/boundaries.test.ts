import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

// Import boundaries from docs/design/04-structure-and-conventions.md section 9.

interface Exception {
  readonly file: string;
  readonly specifier: string;
  readonly why: string;
}

// This list may only shrink. Never add to it to get a pass: move the shared
// code to where both sides may import it instead. A stale entry fails too.
const allowedExceptions: readonly Exception[] = [];

const root = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIPPED = new Set(["node_modules", "dist", "build", "coverage", ".git", "docs", "prototypes"]);
const SKIPPED_PATHS = new Set(["tools/lint-fixtures", "tools/__fixtures__"]);
const TEST_LIBRARIES = ["vitest", "fast-check", "@fast-check/vitest"];
const TEST_FILE = /\.test\.tsx?$/;

const toPosix = (path: string) => path.split(sep).join("/");

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const rel = toPosix(relative(root, path));
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name) && !SKIPPED_PATHS.has(rel)) sourceFiles(path, found);
    } else if (entry.isFile() && SOURCE.test(entry.name)) {
      found.push(rel);
    }
  }
  return found;
}

/** Maps each workspace package name to its folder, relative to the root. */
function workspacePackages(): Map<string, string> {
  const packages = new Map<string, string>();
  for (const parent of ["packages", "apps"]) {
    const base = join(root, parent);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const manifest = join(base, entry.name, "package.json");
      if (!entry.isDirectory() || !existsSync(manifest)) continue;
      const { name } = JSON.parse(readFileSync(manifest, "utf8")) as { name: string };
      packages.set(name, `${parent}/${entry.name}`);
    }
  }
  packages.set("@japacity/tools", "tools");
  return packages;
}

function packageName(specifier: string): string {
  if (specifier.startsWith("node:")) return specifier;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

// Decision 0006 section 3: db holds the SQL. Its runtime code imports the store,
// the simulation's types and the Postgres drivers; the migration tool, PGlite and
// Vitest only in the files that serve the tests and the migrations.
const DB_RUNTIME = ["@japacity/store", "@japacity/sim", "drizzle-orm", "pg"];
const DB_TOOLING_FILES = new Set(["packages/db/drizzle.config.ts", "packages/db/drizzle.migrate.config.ts", "packages/db/src/pglite.ts", "packages/db/src/testing.ts"]);
const DB_TOOLING = ["drizzle-kit", "@electric-sql/pglite", ...TEST_LIBRARIES];

/** The module specifiers a file imports or re-exports for their values, not only their types. */
function valueImports(file: string, text: string): Set<string> {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false);
  const found = new Set<string>();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined && bindings !== undefined && ts.isNamedImports(bindings) && bindings.elements.every((element) => element.isTypeOnly)));
      if (!typeOnly) found.add(statement.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier) && !statement.isTypeOnly) {
      found.add(statement.moduleSpecifier.text);
    }
  }
  return found;
}

const isRelative = (specifier: string) => /^\.\.?(?:\/|$)/.test(specifier);
const inside = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);
const appOf = (path: string) => /^apps\/([^/]+)/.exec(path)?.[1];
const featureOf = (path: string) => /^apps\/client\/src\/features\/([^/]+)\//.exec(path)?.[1];

function violations(files: readonly string[], packages: ReadonlyMap<string, string>): Exception[] {
  const found: Exception[] = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    const imports = ts.preProcessFile(text, true, true).importedFiles.map((entry) => entry.fileName);
    const testLibraries = TEST_FILE.test(file) ? TEST_LIBRARIES : [];

    for (const specifier of imports) {
      const report = (why: string) => found.push({ file, specifier, why });
      const target = isRelative(specifier)
        ? posix.normalize(posix.join(posix.dirname(file), specifier))
        : packages.get(packageName(specifier));

      if (inside(file, "packages/sim/src")) {
        // A simulation test may read content: rule tests play the real game data.
        if (isRelative(specifier) ? !inside(target ?? "", "packages/sim/src") : ![
          "zod",
          ...testLibraries,
          ...(TEST_FILE.test(file) ? ["@japacity/content"] : []),
        ].includes(packageName(specifier))) {
          report("the simulation imports only zod and itself");
        }
      }

      if (inside(file, "packages/content/src")) {
        if (isRelative(specifier) ? !inside(target ?? "", "packages/content/src") : ![
          "@japacity/sim",
          "zod",
          ...testLibraries,
        ].includes(packageName(specifier))) {
          report("content imports only the simulation, zod and itself");
        }
      }

      // Decision 0006 section 3: the client never reaches the server's side, and the store knows no database.
      if (inside(file, "apps/client/src") && ["@japacity/store", "@japacity/db", "@japacity/server"].includes(packageName(specifier))) {
        report("the client imports nothing from store, db or server");
      }
      // The contract suites are written with Vitest on purpose: packages/db runs them.
      const storeLibraries = inside(file, "packages/store/src/contract") ? TEST_LIBRARIES : testLibraries;
      if (inside(file, "packages/store/src") && !isRelative(specifier) && !["@japacity/sim", ...storeLibraries].includes(packageName(specifier))) {
        report("the store imports only the simulation's types and itself");
      }

      if (inside(file, "packages/db")) {
        const allowed = [...DB_RUNTIME, ...(DB_TOOLING_FILES.has(file) || TEST_FILE.test(file) ? DB_TOOLING : [])];
        const name = packageName(specifier);
        if (isRelative(specifier) ? !inside(target ?? "", "packages/db") : !name.startsWith("node:") && !allowed.includes(name)) {
          report("db imports only the store, the simulation's types, Drizzle and pg; the tools for tests and migrations only where they are used");
        }
        if (name === "@japacity/sim" && valueImports(file, text).has(specifier)) report("db imports only types from the simulation");
        if (specifier === "@japacity/store/contract" && !TEST_FILE.test(file)) report("only db's tests import the contract suites, which pull in Vitest");
      }

      if (target !== undefined && inside(target, "packages/db") && ["packages/sim", "packages/store", "apps/client"].some((folder) => inside(file, folder))) {
        report("nothing in sim, store or client imports db");
      }

      const targetApp = target === undefined ? undefined : appOf(target);
      if (targetApp !== undefined && appOf(file) !== targetApp) {
        report(`only files inside apps/${targetApp} may import from it`);
      }

      const fromFeature = featureOf(file);
      const toFeature = target === undefined ? undefined : featureOf(target);
      if (fromFeature !== undefined && toFeature !== undefined && fromFeature !== toFeature) {
        report("a feature does not import another feature; move shared parts to shared/");
      }
    }
  }
  return found;
}

describe("import boundaries", () => {
  const files = sourceFiles(root);
  const found = violations(files, workspacePackages());
  const matches = (a: Exception, b: Exception) => a.file === b.file && a.specifier === b.specifier;

  test("the walk sees the workspace source", () => {
    expect(files).toContain("packages/sim/src/index.ts");
    expect(files).toContain("packages/db/src/index.ts");
    expect(files).toContain("apps/client/src/App.tsx");
  });

  test("no import crosses a boundary outside the allowed exceptions", () => {
    const unexpected = found.filter((violation) => !allowedExceptions.some((allowed) => matches(allowed, violation)));
    expect(unexpected).toEqual([]);
  });

  test("every allowed exception is still needed", () => {
    const stale = allowedExceptions.filter((allowed) => !found.some((violation) => matches(allowed, violation)));
    expect(stale).toEqual([]);
  });
});
