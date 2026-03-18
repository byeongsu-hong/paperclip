import { api } from "./client";

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
};

export const filesystemApi = {
  list: (path?: string) =>
    api.get<{ entries: FileEntry[]; root: string }>(
      `/filesystem${path ? `?path=${encodeURIComponent(path)}` : ""}`
    ),

  readFile: (path: string) =>
    api.get<{ content: string; path: string }>(
      `/filesystem/file?path=${encodeURIComponent(path)}`
    ),
};
