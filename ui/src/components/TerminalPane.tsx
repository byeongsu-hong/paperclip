import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

type Props = {
  wsUrl: string;
};

export function TerminalPane({ wsUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({ cursorBlink: true, fontSize: 13, fontFamily: "monospace" });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      term.onData((data) => ws.send(JSON.stringify({ type: "input", data })));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "output") term.write(msg.data);
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
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, [wsUrl]);

  return <div ref={containerRef} className="h-full w-full bg-black" />;
}
