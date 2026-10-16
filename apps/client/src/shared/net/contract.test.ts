// The client's copies of the server's types against their sources. The client
// may not import the server's side, not even in a test (tests/boundaries.test.ts),
// so this reads both files as text and compares each named declaration as the
// compiler parses it, with comments and spacing set aside.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, test } from "vitest";

import { reportBody } from "../moderation/BlockReport";

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
  ...same(TYPES, "ServerCode", "ServerRejection", "ClockView", "ServerReply", "CommandRequest", "PresetRequest", "PresetStep", "PresetReply", "ViewReply", "WorldReply", "NewCharacterRequest", "PresenceReply"),
  ...same("packages/store/src/types.ts", "Nudge"),
  ...same("apps/server/src/routes/age.ts", "AgeRequest", "AgeStatus"),
  ...same("apps/server/src/routes/account.ts", "AccountView", "DeleteRequest", "GuestRequest", "UsernameRequest"),
  ...same("apps/server/src/account/username.ts", "NameProblem"),
  ...same(INVITE, "InviteMade", "InviteShown", "InviteAccepted"),
  ...same(CONVERSATION, "PairRead", "Said", "ConversationRead"),
  ...same(BLOCK, "Blocked", "Reported"),
  ...same(REPORTS, "ReportReason", "ReportCite", "ReportSubject"),
  ...same("apps/server/src/routes/draw.ts", "DrawReply"),
  { client: ["apps/client/src/features/adverts/adverts.ts", "ServedAdvert"], server: ["apps/server/src/adverts/serve.ts", "ServedAdvert"] },
  { client: ["apps/client/src/features/adverts/adverts.ts", "AdvertsReply"], server: ["apps/server/src/adverts/serve.ts", "AdvertsReply"] },
  { client: ["apps/client/src/features/account/lights.ts", "LightsReply"], server: ["apps/server/src/routes/lights.ts", "LightsReply"] },
  { client: ["apps/client/src/shared/analytics/counters.ts", "CounterRow"], server: ["apps/server/src/analytics/batch.ts", "CounterRow"] },
  { client: ["apps/client/src/shared/analytics/counters.ts", "CounterBatch"], server: ["apps/server/src/analytics/batch.ts", "CounterBatch"] },
  ...["BoardName", "BoardRow", "BoardReply"].map((name): Copy => ({ client: ["apps/client/src/features/boards/boards.ts", name], server: ["apps/server/src/boards/board.ts", name] })),
  { client: ["apps/client/src/features/admin/admin.contract.ts", "Switches"], server: ["packages/store/src/switches.ts", "Switches"] },
];

/** The constants the client copies, compared by their initial value. */
const CONSTANTS: Copy[] = [
  { client: [CONTRACT, "REPORT_REASONS"], server: [REPORTS, "REPORT_REASONS"] },
  { client: ["apps/client/src/features/admin/admin.contract.ts", "SWITCH_NAMES"], server: ["apps/server/src/switches/switches.ts", "SWITCH_NAMES"] },
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

describe("the report route's cite form", () => {
  test("[R-MODERATION-004] given a card or a phrase heard in a place, when it is reported, then the body names no subject for the server to find; an advert names its campaign", () => {
    expect(reportBody({ name: "Tunde" }, { card: "4f1e2d3c" }, "scam", false)).toEqual({ reason: "scam", cites: { card: "4f1e2d3c" } });
    const heard = { place: "place.ojuelegba", phrase: "phrase.hello", at: 5 };
    expect(reportBody({ name: "Someone" }, heard, "harassment", false)).toEqual({ reason: "harassment", cites: heard });
    const slot = { campaign: "campaign-1", slot: "advert.billboard" };
    expect(reportBody({ campaign: "campaign-1", name: "Mama Put" }, slot, "advert", false)).toEqual({ subject: { campaign: "campaign-1" }, reason: "advert", cites: slot });
  });
});
