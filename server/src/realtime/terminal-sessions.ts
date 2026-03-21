import type { IncomingMessage, Server as HttpServer } from "node:http";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";
import os from "node:os";
import path from "node:path";
import { logger } from "../middleware/logger.js";

const WORKSPACE = path.join(process.env.PAPERCLIP_HOME ?? os.homedir(), "workspace");
const AGENT_HOME = path.join(WORKSPACE, "agents");

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

export function handleTerminalWebSocket(ws: WsSocket) {
  // Lazy-require @homebridge/node-pty-prebuilt-multiarch so the module can load even if not yet installed
  let pty: typeof import("@homebridge/node-pty-prebuilt-multiarch");
  try {
    pty = require("@homebridge/node-pty-prebuilt-multiarch") as typeof import("@homebridge/node-pty-prebuilt-multiarch");
  } catch {
    logger.error("terminal WS: node-pty module unavailable");
    ws.send(JSON.stringify({ type: "error", message: "@homebridge/node-pty-prebuilt-multiarch is not available on this server" }));
    ws.close();
    return;
  }

  const shell = process.platform === "win32" ? "powershell.exe" : "bash";

  try {
    mkdirSync(AGENT_HOME, { recursive: true });
  } catch (err) {
    logger.error({ err, workspace: WORKSPACE }, "terminal WS: failed to prepare workspace");
    ws.send(JSON.stringify({ type: "error", message: `Failed to prepare workspace at ${WORKSPACE}` }));
    ws.close();
    return;
  }

  let ptyProcess: ReturnType<typeof pty.spawn>;
  try {
    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: WORKSPACE,
      env: {
        ...process.env,
        AGENT_HOME,
        TERM: "xterm-color",
      } as Record<string, string>,
    });
  } catch (err) {
    logger.error({ err, shell, cwd: WORKSPACE }, "terminal WS: failed to spawn shell");
    ws.send(JSON.stringify({ type: "error", message: `Failed to start shell ${shell}` }));
    ws.close();
    return;
  }

  ptyProcess.onData((data) => {
    if (ws.readyState !== (ws as any).OPEN) return;
    ws.send(JSON.stringify({ type: "output", data }));
  });

  ptyProcess.onExit(({ exitCode }) => {
    try {
      ws.send(JSON.stringify({ type: "exit", exitCode }));
      ws.close();
    } catch {
      // ignore
    }
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "input") ptyProcess.write(msg.data);
      if (msg.type === "resize") ptyProcess.resize(msg.cols, msg.rows);
    } catch {
      // ignore malformed messages
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

export function setupTerminalWebSocketServer(
  server: HttpServer,
  opts: {
    deploymentMode: string;
    resolveSessionFromHeaders?: (headers: Headers) => Promise<{ session: unknown; user: unknown } | null>;
  },
) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WsSocket, req: IncomingMessage) => {
    logger.info({ path: req.url ?? null }, "terminal WS: connection established");
    handleTerminalWebSocket(ws);
  });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!req.url) return;
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/api/terminal") return;

    logger.info(
      {
        path: url.pathname,
        deploymentMode: opts.deploymentMode,
        hasCookie: typeof req.headers.cookie === "string" && req.headers.cookie.length > 0,
      },
      "terminal WS: upgrade request received",
    );

    if (opts.resolveSessionFromHeaders) {
      void (opts.resolveSessionFromHeaders as Function)(new Headers(req.headers as any))
        .then((session: any) => {
          if (!session) {
            logger.warn({ path: url.pathname }, "terminal WS: session not found");
            socket.destroy();
            return;
          }
          try {
            wss.handleUpgrade(req, socket, head, (ws: any) => wss.emit("connection", ws, req));
          } catch (err) {
            logger.error({ err, path: url.pathname }, "terminal WS: handleUpgrade failed");
            socket.destroy();
          }
        })
        .catch((err: unknown) => {
          logger.error({ err, path: url.pathname }, "terminal WS: session resolution failed");
          socket.destroy();
        });
    } else {
      try {
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
      } catch (err) {
        logger.error({ err, path: url.pathname }, "terminal WS: handleUpgrade failed");
        socket.destroy();
      }
    }
  });

  return wss;
}
