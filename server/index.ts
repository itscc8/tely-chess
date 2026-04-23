import { Server } from "socket.io";
import { Server as Engine } from "@socket.io/bun-engine";
import { Chess } from "chess.js";

const io = new Server();
const engine = new Engine({ path: "/socket.io/", cors: { origin: "*" } });
io.bind(engine);

const users: Map<string, { id: string; username: string }> = new Map();

interface Room {
  id: string;
  players: { white: string | null; black: string | null };
  fen: string;
  timers: { white: number; black: number };
  lastMoveTime: number | null;
  turn: "w" | "b";
  gameStarted: boolean;
}

const rooms: Map<string, Room> = new Map();
const TIMER_DURATION = 10 * 60 * 1000; // 10 minutes in ms

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomByPlayerId(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.white === playerId || room.players.black === playerId) {
      return room;
    }
  }
  return undefined;
}

function emitRoomState(room: Room) {
  const state = {
    fen: room.fen,
    turn: room.turn,
    timers: room.timers,
    gameStarted: room.gameStarted,
    players: room.players
  };
  if (room.players.white) {
    io.to(room.players.white).emit("api:room_state", { data: { ...state, color: "w" }, error: null });
  }
  if (room.players.black) {
    io.to(room.players.black).emit("api:room_state", { data: { ...state, color: "b" }, error: null });
  }
}

function updateTimers(room: Room) {
  if (!room.gameStarted || !room.lastMoveTime) return;
  
  const now = Date.now();
  const elapsed = now - room.lastMoveTime;
  room.lastMoveTime = now;
  
  if (room.turn === "w") {
    room.timers.white = Math.max(0, room.timers.white - elapsed);
    if (room.timers.white <= 0) {
      // White ran out of time - Black wins
      if (room.players.white) {
        io.to(room.players.white).emit("api:game_over", { data: { winner: "b", reason: "timeout" }, error: null });
      }
      if (room.players.black) {
        io.to(room.players.black).emit("api:game_over", { data: { winner: "b", reason: "timeout" }, error: null });
      }
      rooms.delete(room.id);
      return;
    }
  } else {
    room.timers.black = Math.max(0, room.timers.black - elapsed);
    if (room.timers.black <= 0) {
      // Black ran out of time - White wins
      if (room.players.white) {
        io.to(room.players.white).emit("api:game_over", { data: { winner: "w", reason: "timeout" }, error: null });
      }
      if (room.players.black) {
        io.to(room.players.black).emit("api:game_over", { data: { winner: "w", reason: "timeout" }, error: null });
      }
      rooms.delete(room.id);
      return;
    }
  }
  
  emitRoomState(room);
}

// Timer update interval
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.gameStarted) {
      updateTimers(room);
    }
  }
}, 100);

io.on("connection", (socket) => {
  const user = { id: socket.id, username: socket.id };
  users.set(socket.id, user);
  console.log(`client connected: ${socket.id}`);

  socket.emit("api:user", { data: user, error: null });
  io.emit("api:users", { data: Array.from(users.values()), error: null });

  socket.on("api:create_room", () => {
    try {
      const existingRoom = getRoomByPlayerId(socket.id);
      if (existingRoom) {
        socket.emit("api:error", { data: null, error: "Already in a room" });
        return;
      }
      
      const roomId = generateRoomCode();
      const room: Room = {
        id: roomId,
        players: { white: socket.id, black: null },
        fen: new Chess().fen(),
        timers: { white: TIMER_DURATION, black: TIMER_DURATION },
        lastMoveTime: null,
        turn: "w",
        gameStarted: false
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit("api:room_created", { data: { roomId, color: "w" }, error: null });
      emitRoomState(room);
    } catch (err) {
      socket.emit("api:error", { data: null, error: "Failed to create room" });
    }
  });

  socket.on("api:join_room", (roomId: string) => {
    try {
      const room = rooms.get(roomId.toUpperCase());
      if (!room) {
        socket.emit("api:error", { data: null, error: "Room not found" });
        return;
      }
      
      if (room.players.black) {
        socket.emit("api:error", { data: null, error: "Room is full" });
        return;
      }
      
      const existingRoom = getRoomByPlayerId(socket.id);
      if (existingRoom) {
        socket.emit("api:error", { data: null, error: "Already in a room" });
        return;
      }
      
      room.players.black = socket.id;
      room.gameStarted = true;
      room.lastMoveTime = Date.now();
      socket.join(roomId);
      socket.emit("api:room_joined", { data: { roomId, color: "b" }, error: null });
      emitRoomState(room);
    } catch (err) {
      socket.emit("api:error", { data: null, error: "Failed to join room" });
    }
  });

  socket.on("api:make_move", (data: { from: string; to: string; promotion?: string }) => {
    try {
      const room = getRoomByPlayerId(socket.id);
      if (!room || !room.gameStarted) {
        socket.emit("api:error", { data: null, error: "Not in an active game" });
        return;
      }
      
      const playerColor = room.players.white === socket.id ? "w" : "b";
      if (room.turn !== playerColor) {
        socket.emit("api:error", { data: null, error: "Not your turn" });
        return;
      }
      
      const game = new Chess(room.fen);
      const move = game.move({ from: data.from, to: data.to, promotion: data.promotion });
      
      if (!move) {
        socket.emit("api:error", { data: null, error: "Invalid move" });
        return;
      }
      
      room.fen = game.fen();
      room.turn = game.turn();
      room.lastMoveTime = Date.now();
      
      if (game.isCheckmate()) {
        const winner = game.turn() === "w" ? "b" : "w";
        if (room.players.white) {
          io.to(room.players.white).emit("api:game_over", { data: { winner, reason: "checkmate" }, error: null });
        }
        if (room.players.black) {
          io.to(room.players.black).emit("api:game_over", { data: { winner, reason: "checkmate" }, error: null });
        }
        rooms.delete(room.id);
        return;
      }
      
      if (game.isDraw()) {
        if (room.players.white) {
          io.to(room.players.white).emit("api:game_over", { data: { winner: null, reason: "draw" }, error: null });
        }
        if (room.players.black) {
          io.to(room.players.black).emit("api:game_over", { data: { winner: null, reason: "draw" }, error: null });
        }
        rooms.delete(room.id);
        return;
      }
      
      emitRoomState(room);
    } catch (err) {
      socket.emit("api:error", { data: null, error: "Failed to make move" });
    }
  });

  socket.on("api:leave_room", () => {
    const room = getRoomByPlayerId(socket.id);
    if (room) {
      const winner = room.players.white === socket.id ? "b" : "w";
      const opponentId = room.players.white === socket.id ? room.players.black : room.players.white;
      if (opponentId) {
        io.to(opponentId).emit("api:game_over", { data: { winner, reason: "resign" }, error: null });
      }
      rooms.delete(room.id);
    }
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    io.emit("api:users", { data: Array.from(users.values()), error: null });
    
    const room = getRoomByPlayerId(socket.id);
    if (room && room.gameStarted) {
      const winner = room.players.white === socket.id ? "b" : "w";
      const opponentId = room.players.white === socket.id ? room.players.black : room.players.white;
      if (opponentId) {
        io.to(opponentId).emit("api:game_over", { data: { winner, reason: "disconnect" }, error: null });
      }
      rooms.delete(room.id);
    }
    
    console.log(`client disconnected: ${socket.id}`);
  });
});

export default {
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`public${filePath}`);
    return new Response(file);
  },
  ...engine.handler(),
};

console.log("Server running on http://localhost:3000");
