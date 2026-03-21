import { useEffect, useRef } from "react";
import { ArrowRightToLine, ArrowDownToLine, GripVertical, GripHorizontal, X, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "../context/SidebarContext";
import { useTerminalPanel } from "../context/TerminalPanelContext";
import { TerminalPane } from "./TerminalPane";
import { cn } from "../lib/utils";

export function GlobalTerminalPanel({ dock }: { dock: "right" | "bottom" }) {
  const { isMobile } = useSidebar();
  const {
    visible,
    hasActivated,
    position,
    width,
    height,
    commandRequest,
    closeTerminalPanel,
    setTerminalPanelPosition,
    setTerminalPanelWidth,
    setTerminalPanelHeight,
  } = useTerminalPanel();
  const dragStateRef = useRef<
    | { kind: "width"; startX: number; startWidth: number }
    | { kind: "height"; startY: number; startHeight: number }
    | null
  >(null);

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal`;

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragStateRef.current;
      if (!drag) return;
      if (drag.kind === "width") {
        setTerminalPanelWidth(drag.startWidth + (drag.startX - event.clientX));
      } else {
        setTerminalPanelHeight(drag.startHeight + (drag.startY - event.clientY));
      }
    }

    function onPointerUp() {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [setTerminalPanelHeight, setTerminalPanelWidth]);

  function startWidthResize(clientX: number) {
    dragStateRef.current = { kind: "width", startX: clientX, startWidth: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function startHeightResize(clientY: number) {
    dragStateRef.current = { kind: "height", startY: clientY, startHeight: height };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }

  if (isMobile || !hasActivated || position !== dock) return null;

  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 overflow-hidden bg-card transition-[opacity,height,width] duration-200 ease-in-out",
        position === "right"
          ? "h-full flex-row border-l border-border"
          : "w-full flex-col border-t border-border",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      style={
        position === "right"
          ? { width: visible ? width : 0 }
          : { height: visible ? height : 0 }
      }
    >
      {position === "right" ? (
        <button
          type="button"
          aria-label="Resize terminal panel width"
          className="flex h-full w-2 shrink-0 cursor-col-resize items-center justify-center bg-border/40 hover:bg-border/70"
          onPointerDown={(event) => startWidthResize(event.clientX)}
        >
          <span className="h-14 w-1 rounded-full bg-muted-foreground/40" />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Resize terminal panel height"
          className="flex h-2 w-full shrink-0 cursor-row-resize items-center justify-center bg-border/40 hover:bg-border/70"
          onPointerDown={(event) => startHeightResize(event.clientY)}
        >
          <span className="h-1 w-14 rounded-full bg-muted-foreground/40" />
        </button>
      )}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          position === "right" ? "w-full min-w-0 border-l border-border/60" : "h-full min-h-0",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SquareTerminal className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">Terminal</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Persistent workspace shell for CLI auth and debugging.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={position === "right" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setTerminalPanelPosition("right")}
              title="Dock right"
            >
              <ArrowRightToLine className="h-4 w-4" />
            </Button>
            <Button
              variant={position === "bottom" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setTerminalPanelPosition("bottom")}
              title="Dock bottom"
            >
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
            <div className="px-1 text-muted-foreground">
              {position === "right" ? <GripVertical className="h-4 w-4" /> : <GripHorizontal className="h-4 w-4" />}
            </div>
            <Button variant="ghost" size="icon-xs" onClick={closeTerminalPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-black">
          <TerminalPane wsUrl={wsUrl} commandRequest={commandRequest} />
        </div>
      </div>
    </aside>
  );
}
