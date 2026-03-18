import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Button } from "@/components/ui/button";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

type Props = {
  cliName: string;
  onComplete: () => void;
};

export function CliAuthTerminal({ cliName, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "monospace",
      rows: 12,
      cols: 80,
      theme: { background: "#0d0d0d" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/models/auth/${cliName}`);
    wsRef.current = ws;

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    ws.onopen = () => {
      term.onData((data) => ws.send(JSON.stringify({ type: "input", data })));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "output") {
          term.write(msg.data as string);
        } else if (msg.type === "auth-url") {
          setAuthUrl(msg.url as string);
        } else if (msg.type === "exit") {
          if (msg.exitCode === 0) {
            setCompleted(true);
            onCompleteRef.current();
          }
        } else if (msg.type === "error") {
          term.write(`\r\n\x1b[31mError: ${msg.message as string}\x1b[0m\r\n`);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => term.write("\r\n[connection closed]\r\n");

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, [cliName]);

  if (completed) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm text-green-600">Authentication complete!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {authUrl && (
        <div className="flex items-center gap-2 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2">
          <span className="text-xs text-muted-foreground flex-1 truncate">Auth URL detected</span>
          <Button variant="outline" size="sm" asChild>
            <a href={authUrl} target="_blank" rel="noreferrer" className="gap-1">
              <ExternalLink className="h-3 w-3" />
              Open in browser
            </a>
          </Button>
        </div>
      )}
      <div
        ref={containerRef}
        className="rounded-md overflow-hidden border border-border"
        style={{ height: "200px" }}
      />
      <p className="text-xs text-muted-foreground">
        When you receive an auth code, paste it in the terminal and press Enter.
      </p>
    </div>
  );
}
