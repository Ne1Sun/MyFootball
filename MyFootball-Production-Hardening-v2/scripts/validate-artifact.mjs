import { readFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workerPath = path.resolve("dist/server/index.js");
const hostingPath = path.resolve("dist/.openai/hosting.json");

if (!fs.existsSync(workerPath)) {
  console.error("Missing Sites Worker entry: dist/server/index.js");
  process.exit(66);
}

if (!fs.existsSync(hostingPath)) {
  console.error("Missing packaged Sites manifest: dist/.openai/hosting.json");
  process.exit(66);
}

try {
  JSON.parse(await readFile(hostingPath, "utf8"));
  const workerUrl = pathToFileURL(workerPath);
  workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
  const worker = await import(workerUrl.href);

  if (!worker.default || typeof worker.default.fetch !== "function") {
    throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
  }

  console.log("Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.");
  process.exit(0);
} catch (error) {
  console.error("Artifact validation failed:", error);
  process.exit(1);
}
