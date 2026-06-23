import esbuild from "esbuild";
import process from "process";

const production = process.argv[2] === "production";

// Node builtins + electron + obsidian are provided by the host; never bundle them.
const external = [
  "obsidian",
  "electron",
  "child_process",
  "fs",
  "path",
  "os",
  "util",
  "events",
  "stream",
];

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external,
  format: "cjs",
  target: "es2020",
  platform: "node",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (production) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
