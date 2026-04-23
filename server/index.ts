import { Server } from "socket.io";
import { serve } from "bun";

const io = new Server({
  cors: { origin: "*" }
});

const users: { id: string; username: string }[] = [];

io.on("connection", (socket) => {
  const user = { id: socket.id, username: socket.id };
  users.push(user);
  console.log(`client connected: ${socket.id}`);

  socket.emit("api:user", { data: user, error: null });
  io.emit("api:users", { data: users, error: null });

  socket.on("api:set_username", async (username: string) => {
    try {
      user.username = username;
      io.emit("api:users", { data: users, error: null });
    } catch (err) {
      socket.emit("api:error", { data: null, error: "Failed to set username" });
    }
  });

  socket.on("disconnect", () => {
    const idx = users.indexOf(user);
    if (idx > -1) users.splice(idx, 1);
    io.emit("api:users", { data: users, error: null });
    console.log(`client disconnected: ${socket.id}`);
  });
});

serve({
  port: 3000,
  async fetch(req) {
    if (req.url.startsWith("/socket.io/")) {
      return io.handleRequest(req);
    }
    const url = new URL(req.url);
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`public${filePath}`);
    return new Response(file);
  },
  websocket: io.websocket,
});

console.log("Server running on http://localhost:3000");
