import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

console.log("Starting cross-platform production build...");

const isWindows = process.platform === "win32";
const binDir = path.resolve("node_modules/.bin");
const vinextCmd = isWindows
  ? path.join(binDir, "vinext.cmd")
  : path.join(binDir, "vinext");

const command = fs.existsSync(vinextCmd) ? vinextCmd : (isWindows ? "npx.cmd" : "npx");
const args = fs.existsSync(vinextCmd) ? ["build"] : ["vinext", "build"];

const child = spawn(command, args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});

const timeoutMs = 3 * 60 * 1000; // 3 minutes timeout
const timer = setTimeout(() => {
  console.error("Build timed out after 3 minutes. Terminating process...");
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 10000);
}, timeoutMs);

child.on("exit", (code) => {
  clearTimeout(timer);
  if (code === 0) {
    console.log("Production build completed successfully.");
    process.exit(0);
  } else {
    console.error(`Build exited with status code: ${code}`);
    process.exit(code || 1);
  }
});
