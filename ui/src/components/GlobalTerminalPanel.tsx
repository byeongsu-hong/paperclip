import { X, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "../context/SidebarContext";
import { useTerminalPanel } from "../context/TerminalPanelContext";
import { TerminalPane } from "./TerminalPane";
import { cn } from "../lib/utils";

export function GlobalTerminalPanel() {
  const { isMobile } = useSidebar();
  const {
    visible,
    hasActivated,
    commandRequest,
    closeTerminalPanel,
  } = useTerminalPanel();

  if (isMobile || !hasActivated) return null;

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal`;

  return (
    <aside
      className={cn(
        "hidden md:flex border-l border-border bg-card shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-in-out",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{ width: visible ? 440 : 0 }}
    >
      <div className="flex w-[440px] min-w-[440px] flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SquareTerminal className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">Terminal</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Persistent workspace shell for CLI auth and debugging.</p>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={closeTerminalPanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 min-h-0 bg-black">
          <TerminalPane wsUrl={wsUrl} commandRequest={commandRequest} />
        </div>
      </div>
    </aside>
  );
}
