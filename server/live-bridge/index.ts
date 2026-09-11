import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { TikTokBridge } from "./bridge";

const configuredHost = process.env.LIVE_BRIDGE_HOST;
const host = configuredHost === undefined || configuredHost === "0.0.0.0" ? configuredHost ?? "0.0.0.0" : "0.0.0.0";
const port = Number(process.env.PORT ?? process.env.LIVE_BRIDGE_PORT ?? 8765);
const bridge = new TikTokBridge();
const wss = new WebSocketServer({ noServer: true });
const server = createServer((request, response) => {
  if (request.url === "/health" || request.url === "/") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "live-war-engine-bridge" }));
    return;
  }

  response.writeHead(404);
  response.end();
});

wss.on("connection", (client) => bridge.handleConnection(client));
server.on("upgrade", (request, socket, head) => {
  if (!request.url?.startsWith("/live-bridge")) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request));
});
server.listen(port, host, () => {
  bridge.startMetrics();
  console.log(`LIVE bridge listening on ws://${host}:${port}`);
});
