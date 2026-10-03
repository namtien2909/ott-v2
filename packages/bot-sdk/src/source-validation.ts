import { BOT_SDK_VERSION, BOT_STATE_SCHEMA_VERSION } from "./version.js";

export type SourceValidationCode =
  | "EMPTY_SOURCE"
  | "SOURCE_TOO_LARGE"
  | "INVALID_UTF8"
  | "ENTRYPOINT_MISSING"
  | "IMPORT_NOT_ALLOWED"
  | "FORBIDDEN_API"
  | "UNBOUNDED_LOOP"
  | "MULTIPLE_ENTRYPOINTS"
  | "UNSUPPORTED_SYNTAX";

export type SourceValidation = Readonly<{
  ok: true;
  sdkVersion: string;
  schemaVersion: string;
  validationLevel: "STATIC_ONLY";
  sourceBytes: number;
}> | Readonly<{
  ok: false;
  code: SourceValidationCode;
  message: string;
}>;

const MAX_SOURCE_BYTES = 64 * 1024;
const ALLOWED_IMPORTS = new Set(["collections", "functools", "heapq", "itertools", "json", "math", "statistics", "typing"]);
const FORBIDDEN_API = /(?:__import__|__getattribute__|__closure__|__func__|__code__|__defaults__|__dict__|__mro__|__subclasses__|__bases__|\b(?:eval|exec|compile|open|input)\s*\(|\b(?:os|sys|socket|subprocess|pathlib|ctypes|importlib|builtins|signal|threading|multiprocessing|globals|locals|getattr|setattr|delattr|vars)\b|__class__|__globals__|__builtins__)/;

function stripPythonTrivia(source: string): string {
  const output = source.split("");
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === "#") {
      while (index < source.length && source[index] !== "\n") output[index++] = " ";
      continue;
    }
    if (character !== "'" && character !== '"') { index += 1; continue; }
    const delimiter = source.startsWith(character.repeat(3), index) ? character.repeat(3) : character;
    const end = delimiter.length;
    for (let offset = 0; offset < end; offset += 1) output[index + offset] = " ";
    index += end;
    while (index < source.length) {
      if (source.startsWith(delimiter, index)) {
        for (let offset = 0; offset < end; offset += 1) output[index + offset] = " ";
        index += end;
        break;
      }
      if (source[index] === "\\" && end === 1) {
        output[index++] = " ";
        if (index < source.length && source[index] !== "\n") output[index++] = " ";
        continue;
      }
      if (source[index] !== "\n") output[index] = " ";
      index += 1;
    }
  }
  return output.join("");
}

export function utf8ByteLength(source: string): number {
  let bytes = 0;
  for (const character of source) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function importAllowed(code: string): boolean {
  const importPattern = /(?:^|[;\n])\s*import\s+([^\n;]+)/g;
  for (const match of code.matchAll(importPattern)) {
    const modules = (match[1] ?? "").split(",").map((item) => (item.trim().split(/\s+as\s+/i)[0] ?? "").split(".")[0]);
    if (modules.some((moduleName) => !ALLOWED_IMPORTS.has(moduleName ?? ""))) return false;
  }
  const fromPattern = /(?:^|[;\n])\s*from\s+([A-Za-z_][\w.]*)\s+import\b/g;
  for (const match of code.matchAll(fromPattern)) {
    const moduleName = (match[1] ?? "").split(".")[0] ?? "";
    if (!ALLOWED_IMPORTS.has(moduleName)) return false;
  }
  return true;
}

export function validateBotSource(source: string): SourceValidation {
  if (source.trim().length === 0) return { ok: false, code: "EMPTY_SOURCE", message: "Tệp chiến thuật đang trống." };
  const sourceBytes = utf8ByteLength(source);
  if (sourceBytes > MAX_SOURCE_BYTES) return { ok: false, code: "SOURCE_TOO_LARGE", message: "Tệp chiến thuật vượt giới hạn 64 KiB." };
  if (source.includes("\u0000")) return { ok: false, code: "INVALID_UTF8", message: "Tệp chứa byte không hợp lệ." };
  // Python normalizes many compatibility characters (including full-width
  // ASCII) in identifiers before lookup. Validate the NFKC form so an unsafe
  // attribute/import cannot bypass the denylist with Unicode spelling.
  const normalizedSource = source.normalize("NFKC");
  if (/(?:^|[^A-Za-z0-9_])(?:rf|fr|f)(?:'{1,3}|"{1,3})/i.test(normalizedSource)) return { ok: false, code: "UNSUPPORTED_SYNTAX", message: "F-string chưa nằm trong static SDK allowlist." };
  const code = stripPythonTrivia(normalizedSource);
  if (!/^def\s+choose_move\s*\(\s*state\s*,\s*memory\s*\)\s*:/m.test(code)) return { ok: false, code: "ENTRYPOINT_MISSING", message: "Cần hàm choose_move(state, memory)." };
  if ((code.match(/^def\s+choose_move\s*\(/gm) ?? []).length !== 1) return { ok: false, code: "MULTIPLE_ENTRYPOINTS", message: "Chỉ được khai báo một choose_move." };
  if (!importAllowed(code)) return { ok: false, code: "IMPORT_NOT_ALLOWED", message: "Import không nằm trong allowlist SDK." };
  if (FORBIDDEN_API.test(code)) return { ok: false, code: "FORBIDDEN_API", message: "Tệp dùng API ngoài sandbox allowlist." };
  if (/\bwhile\b/.test(code)) return { ok: false, code: "UNBOUNDED_LOOP", message: "Không cho phép vòng lặp while không bị giới hạn." };
  return { ok: true, sdkVersion: BOT_SDK_VERSION, schemaVersion: BOT_STATE_SCHEMA_VERSION, validationLevel: "STATIC_ONLY", sourceBytes };
}

type SubtleLike = { digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> };

export async function digestSource(source: string): Promise<string> {
  const subtle = (globalThis as unknown as { crypto?: { subtle?: SubtleLike } }).crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 is unavailable in this runtime.");
  const bytes = new Uint8Array(source.length * 4);
  let offset = 0;
  for (const character of source) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes[offset++] = code;
    else if (code <= 0x7ff) { bytes[offset++] = 0xc0 | (code >> 6); bytes[offset++] = 0x80 | (code & 0x3f); }
    else if (code <= 0xffff) { bytes[offset++] = 0xe0 | (code >> 12); bytes[offset++] = 0x80 | ((code >> 6) & 0x3f); bytes[offset++] = 0x80 | (code & 0x3f); }
    else { bytes[offset++] = 0xf0 | (code >> 18); bytes[offset++] = 0x80 | ((code >> 12) & 0x3f); bytes[offset++] = 0x80 | ((code >> 6) & 0x3f); bytes[offset++] = 0x80 | (code & 0x3f); }
  }
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes.slice(0, offset).buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
