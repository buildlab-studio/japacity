// The client's copies of the server's types against their sources. The client
// may not import the server's side, not even in a test (tests/boundaries.test.ts),
// so this reads both files as text and compares each named declaration as the
// compiler parses it, with comments and spacing set aside.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..", "..", "..", "..");

interface Copy {
  /** The client file and the name the copy has there. */
  client: [file: string, name: string];
  /** The source file and the name it has there. */
  server: [file: string, name: string];
}

const CONTRACT = "apps/client/src/shared/net/contract.ts";
const TYPES = "apps/server/src/types.ts";
const INVITE = "apps/server/src/pair/invite.ts";
const CONVERSATION = "apps/server/src/pair/conversation.ts";
const BLOCK = "apps/server/src/pair/moderation.ts";
const REPORTS = "apps/server/src/moderation/reports.ts";

const same = (file: string, ...names: string[]): Copy[] => names.map((name) => ({ client: [CONTRACT, name], server: [file, name] }));

const COPIES: Copy[] = [
  ...same(TYPES, "ServerCode", "ServerRejection", "ClockView", "ServerReply", "CommandRequest", "ViewReply", "WorldReply", "NewCharacterRequest", "PresenceReply"),
  ...same("packages/store/src/types.ts", "Nudge"),
  ...same("apps/server/src/routes/age.ts", "AgeRequest"),
  ...same("apps/server/src/routes/account.ts", "AccountView", "DeleteRequest"),
  ...same(INVITE, "InviteMade", "InviteShown", "InviteAccepted"),
  ...same(CONVERSATION, "PairRead", "Said", "ConversationRead"),
  ...same(BLOCK, "Blocked", "Reported"),
  ...same(REPORTS, "ReportReason", "ReportCite", "ReportSubject"),
  ...same("apps/server/src/routes/draw.ts", "DrawReply"),
  { client: ["apps/client/src/features/adverts/adverts.ts", "ServedAdvert"], server: ["apps/server/src/adverts/serve.ts", "ServedAdvert"] },
  { client: ["apps/client/src/features/adverts/adverts.ts", "AdvertsReply"], server: ["apps/server/src/adverts/serve.ts", "AdvertsReply"] },
  { client: ["apps/client/src/shared/analytics/counters.ts", "CounterRow"], server: ["apps/server/src/analytics/batch.ts", "CounterRow"] },
  { client: ["apps/client/src/shared/analytics/counters.ts", "CounterBatch"], server: ["apps/server/src/analytics/batch.ts", "CounterBatch"] },
];

/** The constants the client copies, compared by their initial value. */
const CONSTANTS: Copy[] = [
  { client: [CONTRACT, "REPORT_REASONS"], server: [REPORTS, "REPORT_REASONS"] },
  { client: [CONTRACT, "REFUSED_COOKIE"], server: ["apps/server/src/account/age.ts", "REFUSED_COOKIE"] },
];

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(join(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** The declaration's shape as printed: its body only, so the name and `export` do not count. */
function shapeOf(file: string, name: string): string | null {
  const source = parse(file);
  for (const statement of source.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return `interface ${statement.members.map((member) => printer.printNode(ts.EmitHint.Unspecified, member, source)).join(" ")}`;
    }
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return `type ${printer.printNode(ts.EmitHint.Unspecified, statement.type, source)}`;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer !== undefined) {
          return `const ${printer.printNode(ts.EmitHint.Expression, declaration.initializer, source)}`;
        }
      }
    }
  }
  return null;
}

const flat = (printed: string | null) => printed?.replace(/\s+/g, " ").replace(/;\s*}/g, " }").trim() ?? null;

describe("the client's copies of the server's types", () => {
  test.each([...COPIES, ...CONSTANTS].map((copy) => [`${copy.client[1]} (${copy.server[0]})`, copy] as const))("%s is the same as its source", (_, copy) => {
    const source = flat(shapeOf(...copy.server));
    expect(source, `${copy.server[1]} is not declared in ${copy.server[0]}`).not.toBeNull();
    expect(flat(shapeOf(...copy.client))).toBe(source);
  });

  test("a changed copy is caught", () => {
    expect(flat("interface a: string; b: number;")).not.toBe(flat("interface a: string;"));
    expect(flat(shapeOf(CONTRACT, "InviteMade"))).not.toBe(flat(shapeOf(INVITE, "InviteShown")));
  });
});
