# Voice Chess Server

Bun server serving the Voice Chess frontend with Socket.IO for real-time communication.

## Tech Stack

- Bun.serve (high-performance HTTP server)
- Socket.IO

## Running

```bash
bun run index.ts
```

Server runs on http://localhost:3000

## How It Works

1. Serves static files from `public/` directory (built by Next.js client)
2. Handles Socket.IO connections at `/socket.io/*`
3. Manages connected users list

## Socket Events

### Server → Client

- `api:user` - Current user info
- `api:users` - List of connected users

### Client → Server

- `api:set_username` - Set user display name

## Build Output

The `public/` directory is populated by running `bun run build` from the project root, which builds the Next.js client and outputs static files here.
