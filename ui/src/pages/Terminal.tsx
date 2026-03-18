import { TerminalPane } from "@/components/TerminalPane";

export function Terminal() {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal`;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium">Terminal</span>
        <span className="text-xs text-muted-foreground">~/workspace</span>
      </div>
      <div className="flex-1 min-h-0">
        <TerminalPane wsUrl={wsUrl} />
      </div>
    </div>
  );
}
