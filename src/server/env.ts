import fs from 'node:fs';
import path from 'node:path';

/**
 * Pure parser: parses .env / .dev.vars content string into a Record<string, string>.
 * Strips comments, empty lines, and surrounding quotes.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

/**
 * Pure file reader: reads given file paths in order, merging values into a single record.
 * Files earlier in the list take precedence over files later in the list if both define a key.
 */
export function readEnvFiles(
  filePaths: string[],
  readFile: (path: string) => string = (p) => fs.readFileSync(p, 'utf8'),
  fileExists: (path: string) => boolean = (p) => fs.existsSync(p),
): Record<string, string> {
  const combined: Record<string, string> = {};
  for (const filePath of filePaths) {
    if (!fileExists(filePath)) continue;
    try {
      const content = readFile(filePath);
      const parsed = parseEnvContent(content);
      for (const [key, val] of Object.entries(parsed)) {
        if (combined[key] === undefined) {
          combined[key] = val;
        }
      }
    } catch {
      // Ignore errors reading individual files
    }
  }
  return combined;
}

export interface LoadEnvOptions {
  rootDir?: string;
  env?: Record<string, string | undefined>;
  fileNames?: string[];
  override?: boolean;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}

/**
 * Canonical environment loader: loads environment variables from .env and .dev.vars.
 * Single source of truth across CLI scripts (dev, dev:worker, setup) and server runtime (start).
 */
export function loadEnv(options: LoadEnvOptions = {}): Record<string, string | undefined> {
  const rootDir = options.rootDir ?? process.cwd();
  const targetEnv = options.env ?? (process.env as Record<string, string | undefined>);
  const fileNames = options.fileNames ?? ['.env', '.dev.vars'];
  const override = options.override ?? false;

  const filePaths = fileNames.map((name) => path.resolve(rootDir, name));
  const fileVars = readEnvFiles(filePaths, options.readFile, options.fileExists);

  for (const [key, val] of Object.entries(fileVars)) {
    if (override || targetEnv[key] === undefined) {
      targetEnv[key] = val;
    }
  }

  return targetEnv;
}

