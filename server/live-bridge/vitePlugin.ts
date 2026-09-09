import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer } from "ws";
import { TikTokBridge } from "./bridge";

export function tikTokBridgePlugin(): Plugin {
  return {
    name: "tiktok-live-bridge",
    configureServer(server: ViteDevServer) {
      const bridge = new TikTokBridge();
      const wss = new WebSocketServer({ noServer: true });
      const httpServer = server.httpServer;
      if (!httpServer) return;

      wss.on("connection", (client) => bridge.handleConnection(client));
      const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (!request.url?.startsWith("/live-bridge")) return;
        wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request));
      };

      httpServer.on("upgrade", handleUpgrade);
      bridge.startMetrics();
      httpServer.once("close", () => {
        httpServer.off("upgrade", handleUpgrade);
        bridge.stopMetrics();
        wss.close();
      });
    },
  };
}
