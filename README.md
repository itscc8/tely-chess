# Voice Chess

A voice-controlled chess game powered by ElevenLabs AI voice agents. Play chess against a simple AI using voice commands.

## Features

- Voice-controlled chess via ElevenLabs Agents
- Visual 3D orb indicator showing agent state (listening, talking)
- Simple AI opponent that prioritizes captures and checks
- Real-time board visualization

## Tech Stack

- **Client**: Next.js with React, Socket.IO client, ElevenLabs React SDK
- **Server**: Bun.serve with Socket.IO

## Prerequisites

- Node.js 18+ or Bun
- ElevenLabs account with a configured agent

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables in `client/.env.local`:
   ```
   NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id
   ```

3. Build the client:
   ```bash
   bun run build
   ```

4. Start the server:
   ```bash
   bun run start
   ```

5. Open http://localhost:3000

## Development

Run the Next.js dev server:
```bash
bun run dev
```

## Voice Commands

- "What's on the board?" - Get current board state
- "Move from e2 to e4" - Make a chess move

## Project Structure

```
chess/
├── client/          # Next.js frontend
├── server/          # Bun server with Socket.IO
└── package.json     # Workspace scripts
```
