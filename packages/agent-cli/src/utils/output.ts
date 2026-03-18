import pc from "picocolors";

let jsonMode = false;

export function setJsonMode(v: boolean) {
  jsonMode = v;
}

export function printJson(data: unknown) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printTable(rows: Record<string, string>[]) {
  if (rows.length === 0) {
    console.log(pc.dim("(no results)"));
    return;
  }
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)));
  const header = keys.map((k, i) => pc.bold(k.padEnd(widths[i]))).join("  ");
  console.log(header);
  console.log(widths.map((w) => "─".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(keys.map((k, i) => String(row[k] ?? "").padEnd(widths[i])).join("  "));
  }
}

export function output(data: unknown, tableMapper?: (data: unknown) => Record<string, string>[]) {
  if (jsonMode) {
    printJson(data);
  } else if (tableMapper) {
    printTable(tableMapper(data));
  } else {
    printJson(data);
  }
}

export function handleError(err: unknown): never {
  if (err instanceof Error) {
    console.error(pc.red("Error:"), err.message);
  } else {
    console.error(pc.red("Unknown error"));
  }
  process.exit(1);
}
