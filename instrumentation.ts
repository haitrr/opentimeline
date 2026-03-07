export async function register() {
  // Only run in the Node.js runtime (not edge), and only once in the server process.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const port = process.env.MCP_PORT !== undefined ? parseInt(process.env.MCP_PORT, 10) : 3001;
  if (port === 0) return; // disabled

  const { startHttp } = await import("@/mcp/lib");
  await startHttp(port);
}
