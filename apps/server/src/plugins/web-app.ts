import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";

const webRoot = fileURLToPath(new URL("../../../../apps/web/dist/", import.meta.url));

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function safePath(requestUrl: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(requestUrl.split("?", 1)[0] ?? "/");
  } catch {
    return null;
  }
  const relative = pathname.replace(/^[/\\]+/, "") || "index.html";
  const resolved = path.resolve(webRoot, relative);
  const rootWithSeparator = `${webRoot.endsWith(path.sep) ? webRoot : `${webRoot}${path.sep}`}`;
  return resolved === webRoot || resolved.startsWith(rootWithSeparator) ? resolved : null;
}

async function existingFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function registerWebApp(app: FastifyInstance): Promise<void> {
  const sendFile = async (requestUrl: string, reply: FastifyReply) => {
    const requested = safePath(requestUrl);
    const requestedExists = requested ? await existingFile(requested) : false;
    if (requested && !requestedExists && path.extname(requested)) {
      return reply.status(404).send({ code: "WEB_ASSET_NOT_FOUND", message: "Không tìm thấy tài nguyên frontend." });
    }
    const candidate = requestedExists && requested ? requested : path.join(webRoot, "index.html");
    if (!await existingFile(candidate)) {
      return reply.status(503).send({ code: "WEB_BUNDLE_UNAVAILABLE", message: "Frontend bundle chưa được build." });
    }
    const extension = path.extname(candidate).toLowerCase();
    return reply.type(contentTypes[extension] ?? "application/octet-stream").send(await readFile(candidate));
  };

  const shouldServe = (requestUrl: string, accept: string | undefined): boolean => {
    if (accept?.includes("text/html")) return true;
    const requested = safePath(requestUrl);
    return requested !== null && path.extname(requested) !== "";
  };

  app.addHook("onRequest", async (request, reply) => {
    const acceptsHtml = request.headers.accept?.includes("text/html") === true;
    if ((request.method === "GET" || request.method === "HEAD") && acceptsHtml) {
      return sendFile(request.url, reply);
    }
  });
  app.get("/", async (request, reply) => {
    if (shouldServe(request.url, request.headers.accept)) return sendFile(request.url, reply);
    return reply.callNotFound();
  });
  app.get("/*", async (request, reply) => {
    if (shouldServe(request.url, request.headers.accept)) return sendFile(request.url, reply);
    return reply.callNotFound();
  });
}
