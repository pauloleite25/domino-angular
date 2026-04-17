import http from "node:http";
import { existsSync, createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 4310);
const rootDir = fileURLToPath(new URL("..", import.meta.url));
const staticDir = join(rootDir, "dist", "domino-angular", "browser");
const rooms = new Map();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function getRoom(roomId) {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }

  const room = {
    snapshot: null,
    snapshotVersion: 0,
    nextCommandId: 1,
    commands: [],
  };
  rooms.set(roomId, room);
  return room;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(requestUrl, response) {
  const safePath = normalize(decodeURIComponent(requestUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = join(staticDir, safePath === "/" ? "index.html" : safePath);
  const filePath = existsSync(requestedPath) ? requestedPath : join(staticDir, "index.html");

  if (!existsSync(filePath)) {
    sendJson(response, 404, {
      error: "Angular build not found. Run npm run build before starting the server.",
    });
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const parts = requestUrl.pathname.split("/").filter(Boolean);

  if (parts[0] !== "rooms" || !parts[1]) {
    serveStatic(requestUrl, response);
    return;
  }

  const room = getRoom(parts[1]);

  try {
    if (request.method === "GET" && parts[2] === "snapshot") {
      sendJson(response, 200, {
        version: room.snapshotVersion,
        snapshot: room.snapshot,
      });
      return;
    }

    if (request.method === "POST" && parts[2] === "snapshot") {
      const body = await readJson(request);
      room.snapshotVersion += 1;
      room.snapshot = body.snapshot ?? null;
      sendJson(response, 200, { version: room.snapshotVersion });
      return;
    }

    if (request.method === "GET" && parts[2] === "commands") {
      const after = Number(requestUrl.searchParams.get("after") ?? 0);
      sendJson(response, 200, {
        commands: room.commands.filter((command) => command.id > after),
      });
      return;
    }

    if (request.method === "POST" && parts[2] === "commands") {
      const body = await readJson(request);
      const command = {
        id: room.nextCommandId,
        playerId: body.playerId,
        move: body.move,
        createdAt: Date.now(),
      };
      room.nextCommandId += 1;
      room.commands.push(command);
      sendJson(response, 200, command);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Bad request",
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Domino server listening on http://0.0.0.0:${port}`);
});
