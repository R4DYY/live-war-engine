import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { TikTokBridge, normalizeBridgeUsername } from "./bridge";

class FakeClient extends EventEmitter {
  readyState = WebSocket.OPEN;
  messages: string[] = [];

  send(message: string): void {
    this.messages.push(message);
  }
}

describe("TikTok bridge protocol", () => {
  it("normalizes and validates usernames at the bridge boundary", () => {
    expect(normalizeBridgeUsername(" @@creator ")).toBe("creator");
    expect(normalizeBridgeUsername("  ")).toBeNull();
  });

  it("sends explicit bridge and TikTok status messages on connect", () => {
    const bridge = new TikTokBridge();
    const client = new FakeClient();

    bridge.handleConnection(client as unknown as WebSocket);

    expect(client.messages.map((message) => JSON.parse(message).type)).toEqual([
      "BRIDGE_STATUS",
      "TIKTOK_STATUS",
    ]);
  });

  it("returns a typed error for an empty connect command", () => {
    const bridge = new TikTokBridge();
    const client = new FakeClient();
    bridge.handleConnection(client as unknown as WebSocket);
    client.emit("message", Buffer.from(JSON.stringify({ type: "CONNECT_TIKTOK", payload: { username: " @ " } })));

    const error = JSON.parse(client.messages.at(-1) ?? "{}");
    expect(error).toMatchObject({ type: "TIKTOK_ERROR", code: "USERNAME_REQUIRED" });
  });
});
