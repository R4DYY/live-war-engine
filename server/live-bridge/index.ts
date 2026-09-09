import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { TikTokBridge } from "./bridge";

const host = process.env.LIVE_BRIDGE_HOST ?? "127.0.0.1";
const port = Number(process.env.LIVE_BRIDGE_PORT ?? 8765);
const bridge = new TikTokBridge();
const wss = new WebSocketServer({ noServer: true });
const server = createServer();

wss.on("connection", (client) => bridge.handleConnection(client));
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request));
});
server.listen(port, host, () => {
  bridge.startMetrics();
  console.log(`LIVE bridge listening on ws://${host}:${port}`);
});
