// Vessel is local-first: the app must not depend on cloud sign-in, relays or public STUN/TURN.
// This scans the sources so removed cloud integrations do not creep back in. No server needed.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE_DIRS = [
  "apps/client/src",
  "apps/server/src",
  "apps/desktop/src-tauri/src",
];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".rs"]);

const FORBIDDEN = [
  { pattern: /supabase/i, why: "cloud sign-in (Supabase)" },
  { pattern: /tunnel\.cartesiancs\.com/, why: "cartesiancs tunnel relay" },
  { pattern: /\bstuns?:[a-z0-9.-]+/i, why: "external STUN server" },
  { pattern: /\bturns?:[a-z0-9.-]+/i, why: "external TURN server" },
  { pattern: /turn_server_config/, why: "TURN configuration" },
  { pattern: /capsule-client|CapsuleClient/, why: "Capsule relay client" },
];

function sourceFiles(dir) {
  const out = [];
  const stack = [path.join(ROOT, dir)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
    }
  }
  return out;
}

describe("local-first sources", () => {
  const files = SOURCE_DIRS.flatMap(sourceFiles);

  it("finds the sources to scan", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN.map((f) => [f.why, f.pattern]))(
    "contain no %s",
    (_why, pattern) => {
      const hits = files.flatMap((file) =>
        fs
          .readFileSync(file, "utf8")
          .split("\n")
          .map((line, i) => ({ line, i }))
          .filter(({ line }) => pattern.test(line))
          .map(
            ({ line, i }) =>
              `${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`,
          ),
      );
      expect(hits).toEqual([]);
    },
  );
});
