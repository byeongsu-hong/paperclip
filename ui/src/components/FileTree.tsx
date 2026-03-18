import { Folder, File } from "lucide-react";
import type { FileEntry } from "@/api/filesystem";
import { cn } from "@/lib/utils";

type Props = {
  entries: FileEntry[];
  onSelect: (entry: FileEntry) => void;
  selectedPath?: string;
};

export function FileTree({ entries, onSelect, selectedPath }: Props) {
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <button
          key={entry.path}
          onClick={() => onSelect(entry)}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent/50 text-left w-full",
            selectedPath === entry.path && "bg-accent text-accent-foreground"
          )}
        >
          {entry.type === "directory" ? (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{entry.name}</span>
          {entry.type === "file" && entry.size !== undefined && (
            <span className="ml-auto text-xs text-muted-foreground shrink-0">
              {(entry.size / 1024).toFixed(1)}KB
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
