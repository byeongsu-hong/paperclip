import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { filesystemApi, type FileEntry } from "@/api/filesystem";
import { FileTree } from "@/components/FileTree";

export function Filesystem() {
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  const { data: dirData } = useQuery({
    queryKey: ["filesystem", "list", currentPath ?? "root"],
    queryFn: () => filesystemApi.list(currentPath),
  });

  const { data: fileData } = useQuery({
    queryKey: ["filesystem", "file", selectedFile?.path],
    queryFn: () => filesystemApi.readFile(selectedFile!.path),
    enabled: !!selectedFile && selectedFile.type === "file",
  });

  function handleSelect(entry: FileEntry) {
    if (entry.type === "directory") {
      setCurrentPath(entry.path);
      setSelectedFile(null);
    } else {
      setSelectedFile(entry);
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
          ~/workspace
          {currentPath && (
            <button
              className="ml-2 text-primary hover:underline"
              onClick={() => { setCurrentPath(undefined); setSelectedFile(null); }}
            >
              root
            </button>
          )}
        </div>
        {dirData && (
          <FileTree
            entries={dirData.entries}
            onSelect={handleSelect}
            selectedPath={selectedFile?.path}
          />
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {selectedFile && fileData ? (
          <div>
            <h2 className="text-sm font-mono text-muted-foreground mb-4">{selectedFile.path}</h2>
            <pre className="text-xs font-mono bg-muted/30 rounded p-4 overflow-x-auto whitespace-pre-wrap">
              {fileData.content}
            </pre>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select a file to view its contents.</div>
        )}
      </div>
    </div>
  );
}
