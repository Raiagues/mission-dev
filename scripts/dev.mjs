import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;
const vite = resolve(root, "node_modules/vite/bin/vite.js");
const children = [
  spawn(node, [resolve(root, "server/index.mjs")], { cwd: root, stdio: "inherit", env: process.env }),
  spawn(node, [vite, "--host", "127.0.0.1", "--port", "5173", "--strictPort", "--open", "/norte/"], { cwd: root, stdio: "inherit", env: process.env })
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 250);
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!stopping && (code !== 0 || signal)) stop(code || 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
