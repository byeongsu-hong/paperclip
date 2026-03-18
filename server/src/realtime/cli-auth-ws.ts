import type { IncomingMessage, Server as HttpServer } from "node:http";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";
import os from "node:os";
import { CLI_AUTH_COMMANDS } from "../services/cli-auth.js";

interface WsSocket {
  readyState: number;
  OPEN: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message", listener: (data: Buffer | string) => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

interface WsServer {
  on(event: "connection", listener: (socket: WsSocket, req: IncomingMessage) => void): void;
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    callback: (ws: WsSocket) => void,
  ): void;
  emit(event: "connection", ws: WsSocket, req: IncomingMessage): boolean;
}

const require = createRequire(import.meta.url);
const { WebSocketServer } = require("ws") as {
  WebSocketServer: new (opts: { noServer: boolean }) => WsServer;
};

export function handleCliAuthWebSocket(ws: WsSocket, cliName: string) {
  const authCmd = CLI_AUTH_COMMANDS[cliName];
  if (!authCmd) {
    ws.send(JSON.stringify({ type: "error", message: `Unknown CLI: ${cliName}` }));
    ws.close();
    return;
  }

  // Lazy-require node-pty so the module can load even if not yet installed
  let pty: typeof import("node-pty");
  try {
    pty = require("node-pty") as typeof import("node-pty");
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "node-pty is not available on this server" }));
    ws.close();
    return;
  }

  const [bin, ...args] = authCmd;
  const cwd = os.homedir();

  const ptyProcess = pty.spawn(bin, args, {
    name: "xterm-color",
    cols: 120,
    rows: 30,
    cwd,
    env: process.env as Record<string, string>,
  });

  // PTY → WebSocket
  ptyProcess.onData((data) => {
    if (ws.readyState !== (ws as any).OPEN) return;
    ws.send(JSON.stringify({ type: "output", data }));

    // URL auto-detection
    const urlMatch = data.match(/(https:\/\/[^\s\r\n]+)/);
    if (urlMatch) {
      ws.send(JSON.stringify({ type: "auth-url", url: urlMatch[1] }));
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    try {
      ws.send(JSON.stringify({ type: "exit", exitCode }));
      ws.close();
    } catch {
      // ignore
    }
  });

  // WebSocket → PTY
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "input") ptyProcess.write(msg.data);
      if (msg.type === "resize") ptyProcess.resize(msg.cols, msg.rows);
    } catch {
      // ignore
    }
  });

  ws.on("close", () => {
    try {
      ptyProcess.kill();
    } catch {
      // ignore
    }
  });
}

export function setupCliAuthWebSocketServer(
  server: HttpServer,
  opts: {
    deploymentMode: string;
    resolveSessionFromHeaders?: (headers: Headers) => Promise<{ session: unknown; user: unknown } | null>;
  },
) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WsSocket, req: IncomingMessage) => {
    // Extract CLI name from URL: /api/models/auth/<cliName>
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/");
    const cliName = parts[parts.length - 1];
    handleCliAuthWebSocket(ws, cliName);
  });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!req.url) return;
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/models/auth/")) return;

    if (opts.resolveSessionFromHeaders) {
      void (opts.resolveSessionFromHeaders as Function)(new Headers(req.headers as any))
        .then((session: any) => {
          if (!session) { socket.destroy(); return; }
          wss.handleUpgrade(req, socket, head, (ws: any) => wss.emit("connection", ws, req));
        })
        .catch(() => socket.destroy());
    } else {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    }
  });

  return wss;
}
