# Voice Chess Client

Next.js frontend for Voice Chess with ElevenLabs voice agent integration.

## Tech Stack

- Next.js 15 with App Router
- React 19
- ElevenLabs React SDK
- Socket.IO Client
- chess.js
- Three.js (Orb visualization)

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id
```

## Development

```bash
bun run dev
```

## Build

```bash
bun run build
```

Outputs static files to `../server/public/` for the Bun server to serve.

## Features

- Interactive chess board with click-to-move
- Voice agent integration via ElevenLabs
- 3D animated orb showing agent state
- Dark theme with cyan accents
- Mobile responsive
