import http from "node:http";
import { existsSync, createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 4310);
const rootDir = fileURLToPath(new URL("..", import.meta.url));
const staticDir = join(rootDir, "dist", "domino-angular", "browser");
const rooms = new Map();
const joinableRoles = ["B", "C", "D"];
const playerRoles = ["A", "B", "C", "D"];

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function normalizeRoomId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizePlayerName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function isPlaceholderPlayerName(role, name) {
  return normalizePlayerName(name).toLowerCase() === `jogador ${role.toLowerCase()}`;
}

function getPublicPlayerNames(room) {
  const playerNames = room.playerNames ?? {};

  return playerRoles.reduce((names, role) => {
    const name = normalizePlayerName(playerNames[role]);
    if (name && !isPlaceholderPlayerName(role, name)) {
      names[role] = name;
    }

    return names;
  }, {});
}

function publicRoom(roomId, room) {
  return {
    roomId,
    humanPlayers: getHumanPlayers(room),
    playerNames: getPublicPlayerNames(room),
    occupiedRoles: Array.from(room.occupiedRoles),
    availableRoles: joinableRoles.filter((role) => !room.occupiedRoles.has(role)),
  };
}

function syncRoomInfoIntoSnapshot(room) {
  if (room.snapshot === null) {
    return;
  }

  room.snapshot = {
    ...room.snapshot,
    humanPlayers: getHumanPlayers(room),
    playerNames: getPublicPlayerNames(room),
  };
  room.snapshotVersion += 1;
}

function getHumanPlayers(room) {
  const occupiedRoles = room.occupiedRoles ?? new Set(room.humanPlayers ?? ["A"]);
  return playerRoles.filter((role) => occupiedRoles.has(role));
}

function normalizeHumanPlayers(value) {
  if (!Array.isArray(value)) {
    return ["A"];
  }

  const players = value
    .map((role) => String(role ?? "").toUpperCase())
    .filter((role) => playerRoles.includes(role));

  return players.length > 0 ? Array.from(new Set(players)) : ["A"];
}

function mergeHumanPlayers(...groups) {
  const players = groups
    .flat()
    .map((role) => String(role ?? "").toUpperCase())
    .filter((role) => playerRoles.includes(role));

  return playerRoles.filter((role) => players.includes(role));
}

function normalizePlayerNames(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return playerRoles.reduce((names, role) => {
    const name = normalizePlayerName(value[role]);
    if (name && !isPlaceholderPlayerName(role, name)) {
      names[role] = name;
    }

    return names;
  }, {});
}

function getRoom(roomId) {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }

  const room = {
    password: "",
    humanPlayers: ["A"],
    playerNames: {},
    occupiedRoles: new Set(),
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

  if (parts[0] !== "rooms") {
    serveStatic(requestUrl, response);
    return;
  }

  try {
    if (request.method === "POST" && parts.length === 1) {
      const body = await readJson(request);
      const roomId = normalizeRoomId(body.roomId);
      const password = String(body.password ?? "");
      const playerName = normalizePlayerName(body.playerName);

      if (!roomId) {
        sendJson(response, 400, { error: "Nome da sala invalido." });
        return;
      }

      if (!password.trim()) {
        sendJson(response, 400, { error: "Informe uma senha para a sala." });
        return;
      }

      if (!playerName) {
        sendJson(response, 400, { error: "Informe seu nome." });
        return;
      }

      if (rooms.has(roomId)) {
        sendJson(response, 409, { error: "Ja existe uma sala com esse nome." });
        return;
      }

      const room = {
        password,
        humanPlayers: ["A"],
        playerNames: { A: playerName },
        occupiedRoles: new Set(["A"]),
        snapshot: null,
        snapshotVersion: 0,
        nextCommandId: 1,
        commands: [],
      };
      rooms.set(roomId, room);
      sendJson(response, 201, {
        ...publicRoom(roomId, room),
        role: "A",
      });
      return;
    }

    if (!parts[1]) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const roomId = normalizeRoomId(parts[1]);
    const room = rooms.get(roomId);

    if (request.method === "GET" && parts.length === 2) {
      sendJson(response, 200, {
        exists: room !== undefined,
        room: room ? publicRoom(roomId, room) : null,
      });
      return;
    }

    if (request.method === "POST" && parts[2] === "join") {
      const body = await readJson(request);
      if (!room) {
        sendJson(response, 404, { error: "Sala nao encontrada." });
        return;
      }

      if (String(body.password ?? "") !== room.password) {
        sendJson(response, 401, { error: "Senha incorreta." });
        return;
      }

      const role = String(body.role ?? "").toUpperCase();
      const playerName = normalizePlayerName(body.playerName);
      if (!joinableRoles.includes(role)) {
        sendJson(response, 400, { error: "Escolha uma posicao valida." });
        return;
      }

      if (!playerName) {
        sendJson(response, 400, { error: "Informe seu nome." });
        return;
      }

      if (room.occupiedRoles.has(role)) {
        sendJson(response, 409, { error: "Sala cheia." });
        return;
      }

      room.occupiedRoles.add(role);
      room.humanPlayers = getHumanPlayers(room);
      room.playerNames = {
        ...room.playerNames,
        [role]: playerName,
      };
      syncRoomInfoIntoSnapshot(room);
      sendJson(response, 200, {
        ...publicRoom(roomId, room),
        role,
      });
      return;
    }

    const activeRoom = room ?? getRoom(roomId);

    if (request.method === "GET" && parts[2] === "snapshot") {
      sendJson(response, 200, {
        version: activeRoom.snapshotVersion,
        snapshot: activeRoom.snapshot,
        room: publicRoom(roomId, activeRoom),
      });
      return;
    }

    if (request.method === "POST" && parts[2] === "snapshot") {
      const body = await readJson(request);
      const snapshot = body.snapshot ?? null;
      if (snapshot !== null) {
        activeRoom.humanPlayers = mergeHumanPlayers(
          getHumanPlayers(activeRoom),
          normalizeHumanPlayers(snapshot.humanPlayers ?? activeRoom.humanPlayers),
        );
        activeRoom.occupiedRoles = new Set(activeRoom.humanPlayers);
        activeRoom.playerNames = {
          ...(activeRoom.playerNames ?? {}),
          ...normalizePlayerNames(snapshot.playerNames),
        };
      }
      activeRoom.snapshotVersion += 1;
      activeRoom.snapshot =
        snapshot === null
          ? null
          : {
              ...snapshot,
              humanPlayers: activeRoom.humanPlayers,
              playerNames: getPublicPlayerNames(activeRoom),
            };
      sendJson(response, 200, {
        version: activeRoom.snapshotVersion,
        room: publicRoom(roomId, activeRoom),
      });
      return;
    }

    if (request.method === "GET" && parts[2] === "commands") {
      const after = Number(requestUrl.searchParams.get("after") ?? 0);
      sendJson(response, 200, {
        commands: activeRoom.commands.filter((command) => command.id > after),
      });
      return;
    }

    if (request.method === "POST" && parts[2] === "commands") {
      const body = await readJson(request);
      const command = {
        id: activeRoom.nextCommandId,
        playerId: body.playerId,
        action: body.action ?? "move",
        move: body.move,
        emoji: body.emoji,
        sound: body.sound,
        createdAt: Date.now(),
      };
      activeRoom.nextCommandId += 1;
      activeRoom.commands.push(command);
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
