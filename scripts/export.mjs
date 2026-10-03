import { cp, mkdir, rm } from "node:fs/promises";
await rm("artifacts/site", { recursive: true, force: true });
await mkdir("artifacts/site", { recursive: true });
await cp("dist", "artifacts/site", { recursive: true, force: true });
console.log("Static export copied to artifacts/site.");
