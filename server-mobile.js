const http = require("http");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const MAX_PLAYERS = 8;

const rooms = new Map();

function makeRoomCode() {
  let code;

  do {
    code =
      "BLACK-" +
      Math.floor(1000 + Math.random() * 9000);
  } while (rooms.has(code));

  return code;
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data, except = null) {
  if (!room) return;

  for (const client of room.clients) {
    if (client !== except) {
      send(client, data);
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Black Roots Multiplayer Server is ONLINE");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Black Roots Multiplayer Server is ONLINE");
});

const wss = new WebSocket.Server({
  server: server
});

wss.on("connection", (ws) => {

  ws.player = {
    id: Math.random().toString(36).slice(2, 10),
    name: "مهمان",
    x: 0,
    y: 1.7,
    z: 0,
    ry: 0,
    room: null
  };

  send(ws, {
    type: "connected",
    id: ws.player.id
  });

  ws.on("message", (message) => {

    let data;

    try {
      data = JSON.parse(message.toString());
    } catch {
      send(ws, {
        type: "error",
        message: "پیام نامعتبر است"
      });
      return;
    }

    const player = ws.player;

    // ساخت اتاق
    if (data.type === "create-room") {

      if (player.room) {
        send(ws, {
          type: "error",
          message: "شما قبلاً داخل یک اتاق هستید"
        });
        return;
      }

      const code = makeRoomCode();

      const room = {
        code: code,
        clients: new Set()
      };

      rooms.set(code, room);

      player.room = code;
      player.name = String(
        data.name || "مهمان"
      ).slice(0, 20);

      room.clients.add(ws);

      send(ws, {
        type: "room-created",
        room: code,
        id: player.id,
        players: []
      });

      return;
    }

    // ورود به اتاق
    if (data.type === "join-room") {

      if (player.room) {
        send(ws, {
          type: "error",
          message: "شما قبلاً داخل یک اتاق هستید"
        });
        return;
      }

      const code = String(
        data.room || ""
      ).trim().toUpperCase();

      const room = rooms.get(code);

      if (!room) {
        send(ws, {
          type: "error",
          message: "اتاق پیدا نشد"
        });
        return;
      }

      if (room.clients.size >= MAX_PLAYERS) {
        send(ws, {
          type: "error",
          message: "اتاق پر است"
        });
        return;
      }

      player.room = code;
      player.name = String(
        data.name || "مهمان"
      ).slice(0, 20);

      room.clients.add(ws);

      const players = [];

      for (const client of room.clients) {
        if (client !== ws) {
          players.push(client.player);
        }
      }

      send(ws, {
        type: "room-joined",
        room: code,
        id: player.id,
        players: players
      });

      broadcast(
        room,
        {
          type: "player-joined",
          player: player
        },
        ws
      );

      return;
    }

    // حرکت بازیکن
    if (data.type === "move") {

      if (!player.room) return;

      const room = rooms.get(player.room);

      if (!room) return;

      player.x = Number(data.x) || 0;
      player.y = Number(data.y) || 1.7;
      player.z = Number(data.z) || 0;
      player.ry = Number(data.ry) || 0;

      broadcast(
        room,
        {
          type: "player-moved",
          id: player.id,
          x: player.x,
          y: player.y,
          z: player.z,
          ry: player.ry
        },
        ws
      );

      return;
    }

    // چت
    if (data.type === "chat") {

      if (!player.room) return;

      const room = rooms.get(player.room);

      if (!room) return;

      broadcast(room, {
        type: "chat",
        id: player.id,
        name: player.name,
        text: String(data.text || "").slice(0, 200)
      });

      return;
    }

    // خروج از اتاق
    if (data.type === "leave-room") {
      leaveRoom(ws);
      return;
    }

  });

  ws.on("close", () => {
    leaveRoom(ws);
  });
});

function leaveRoom(ws) {

  const player = ws.player;

  if (!player || !player.room) {
    return;
  }

  const roomCode = player.room;
  const room = rooms.get(roomCode);

  player.room = null;

  if (!room) {
    return;
  }

  room.clients.delete(ws);

  broadcast(room, {
    type: "player-left",
    id: player.id
  });

  if (room.clients.size === 0) {
    rooms.delete(roomCode);
  }
}

server.listen(PORT, HOST, () => {

  console.log("----------------------------------------");
  console.log("Black Roots Multiplayer Server ONLINE");
  console.log("HTTP:", `http://0.0.0.0:${PORT}`);
  console.log("WebSocket:", `ws://0.0.0.0:${PORT}`);
  console.log("Max players:", MAX_PLAYERS);
  console.log("----------------------------------------");

});
