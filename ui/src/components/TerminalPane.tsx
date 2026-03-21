import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { TerminalCommandRequest } from "../context/TerminalPanelContext";
import "@xterm/xterm/css/xterm.css";

type Props = {
  wsUrl: string;
  commandRequest?: TerminalCommandRequest | null;
};

export function TerminalPane({ wsUrl, commandRequest = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queuedInputRef = useRef<string[]>([]);

  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "input", data }));
      return;
    }
    queuedInputRef.current.push(data);
  }, []);

  useEffect(() => {
    if (!commandRequest) return;
    sendInput(`${commandRequest.command}\r`);
  }, [commandRequest, sendInput]);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({ cursorBlink: true, fontSize: 13, fontFamily: "monospace" });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      while (queuedInputRef.current.length > 0) {
        const next = queuedInputRef.current.shift();
        if (next == null) break;
        ws.send(JSON.stringify({ type: "input", data: next }));
      }
    };

    const disposable = term.onData((data) => sendInput(data));

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "output") term.write(msg.data);
        if (msg.type === "error") term.write(`\r\n\x1b[31mError: ${msg.message as string}\x1b[0m\r\n`);
        if (msg.type === "exit") term.write(`\r\n[process exited: ${String(msg.exitCode)}]\r\n`);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => term.write("\r\n[Connection closed]\r\n");

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    });
    observer.observe(containerRef.current);

    return () => {
      disposable.dispose();
      observer.disconnect();
      ws.close();
      wsRef.current = null;
      term.dispose();
    };
  }, [sendInput, wsUrl]);

  return <div ref={containerRef} className="h-full w-full bg-black" />;
}
