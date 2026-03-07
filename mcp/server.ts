import "dotenv/config";
import { startStdio, startHttp } from "./lib.js";

const port = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : undefined;
const useHttp = !!port || process.argv.includes("--http");
const httpPort = port ?? 3001;

async function main() {
  if (useHttp) {
    await startHttp(httpPort);
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
