import { spawn } from "node:child_process";

const processes = [
  spawn("node", ["scripts/lan-duo-server.mjs"], {
    env: { ...process.env, PORT: process.env.ROOM_PORT ?? "4310" },
    shell: false,
    stdio: "inherit",
  }),
  spawn("npx", ["ng", "serve", "--host", "0.0.0.0", "--poll", "1000"], {
    shell: false,
    stdio: "inherit",
  }),
];

function stopAll(exitCode = 0) {
  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(exitCode);
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      stopAll(code);
    }
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
