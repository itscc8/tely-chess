"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
  useConversationClientTool,
} from "@elevenlabs/react";
import { Orb } from "@/components/ui/orb";
import { useSocket } from "@/hooks/useSocket";

const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function ChessBoard({
  game,
  onMove,
  selectedSquare,
  onSelectSquare,
  legalMoves,
}: {
  game: Chess;
  onMove: (from: string, to: string) => void;
  selectedSquare: string | null;
  onSelectSquare: (sq: string) => void;
  legalMoves: string[];
}) {
  const board = game.board();

  return (
    <div className="relative">
      <div className="absolute -inset-2 bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-cyan-500/20 rounded-xl blur-xl" />
      <div className="relative grid grid-cols-8 border-4 border-cyan-400/50 rounded-xl overflow-hidden shadow-2xl shadow-cyan-500/30">
        {board.flatMap((row, rank) =>
          row.map((piece, file) => {
            const square = `${String.fromCharCode(97 + file)}${8 - rank}` as Square;
            const isLight = (rank + file) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isLegalMove = legalMoves.includes(square);

            return (
              <button
                key={square}
                onClick={() => onSelectSquare(square)}
                className={`
                  w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center
                  text-2xl sm:text-3xl md:text-4xl transition-all duration-200
                  ${isLight ? "bg-zinc-400" : "bg-zinc-500"}
                  ${isSelected ? "bg-cyan-400/60 ring-2 ring-cyan-300 scale-105 z-10" : ""}
                  ${isLegalMove ? "ring-2 ring-cyan-300/70" : ""}
                  hover:brightness-110
                `}
              >
                {piece && (
                  <span
                    className={`
                      drop-shadow-lg
                      ${piece.color === "w" ? "text-white" : "text-zinc-900"}
                    `}
                  >
                    {PIECE_SYMBOLS[piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase()]}
                  </span>
                )}
                {isLegalMove && !piece && (
                  <span className="w-3 h-3 rounded-full bg-cyan-300/60" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function AgentPanel({ game, makeMove }: { game: Chess; makeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => boolean }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking, isListening } = useConversationMode();

  const agentState = useMemo(() => {
    if (status !== "connected") return null;
    if (isSpeaking) return "talking";
    if (isListening) return "listening";
    return null;
  }, [status, isSpeaking, isListening]);

  const getBoardDescription = useCallback(() => {
    const turn = game.turn() === "w" ? "White" : "Black";
    const board = game.board();
    const pieces: string[] = [];

    board.forEach((row, rank) => {
      row.forEach((piece, file) => {
        if (piece) {
          const square = `${String.fromCharCode(97 + file)}${8 - rank}`;
          const pieceName = {
            p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
          }[piece.type];
          const color = piece.color === "w" ? "White" : "Black";
          pieces.push(`${color} ${pieceName} on ${square}`);
        }
      });
    });

    const status = game.isCheckmate()
      ? "Checkmate!"
      : game.isCheck()
      ? "Check!"
      : game.isDraw()
      ? "Draw"
      : `${turn} to move`;

    return `Board status: ${status}. Pieces: ${pieces.join(", ")}.`;
  }, [game]);

  useConversationClientTool("getBoard", () => getBoardDescription());

  useConversationClientTool("makeMove", (params: Record<string, unknown>) => {
    const { from, to, promotion } = params as { from: string; to: string; promotion?: string };
    const success = makeMove(from, to, promotion as "q" | "r" | "b" | "n" | undefined);
    return success ? `Move ${from} to ${to} completed.` : `Invalid move: ${from} to ${to}.`;
  });

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-zinc-800/50 rounded-2xl border border-cyan-500/20 backdrop-blur-sm">
      <div className="w-40 h-40 sm:w-48 sm:h-48">
        <Orb
          agentState={agentState}
          colors={["#22d3ee", "#a855f7"]}
        />
      </div>

      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-green-400 animate-pulse" : "bg-zinc-500"}`} />
          <p className="text-sm text-zinc-300">
            {status === "connected" ? "Connected" : "Disconnected"}
          </p>
        </div>
      </div>

      {status === "connected" ? (
        <button
          onClick={() => endSession()}
          className="w-full px-6 py-3 bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 rounded-xl border border-red-500/30 hover:from-red-500/30 hover:to-pink-500/30 transition-all font-semibold"
        >
          End Session
        </button>
      ) : (
        <button
          onClick={() => {
            const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
            if (agentId) {
              startSession({ agentId });
            } else {
              console.error("Missing NEXT_PUBLIC_ELEVENLABS_AGENT_ID");
            }
          }}
          className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 rounded-xl border border-cyan-500/30 hover:from-cyan-500/30 hover:to-purple-500/30 transition-all font-semibold"
        >
          Start Voice Agent
        </button>
      )}

      <div className="text-xs text-zinc-400 text-center space-y-1 pt-2 border-t border-zinc-700 w-full">
        <p className="font-semibold text-zinc-300">Voice Commands:</p>
        <p>"What's on the board?"</p>
        <p>"Move from e2 to e4"</p>
      </div>
    </div>
  );
}

function simpleAIMove(game: Chess): { from: string; to: string } | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  const captures = moves.filter((m) => m.captured);
  const checks = moves.filter((m) => {
    game.move(m.san);
    const isCheck = game.isCheck();
    game.undo();
    return isCheck;
  });

  let move: typeof moves[0];
  if (captures.length > 0) {
    move = captures[Math.floor(Math.random() * captures.length)];
  } else if (checks.length > 0) {
    move = checks[Math.floor(Math.random() * checks.length)];
  } else {
    const centerMoves = moves.filter(
      (m) => ["d3", "d4", "e3", "e4", "c3", "c4", "f3", "f4"].includes(m.to)
    );
    if (centerMoves.length > 0 && Math.random() > 0.5) {
      move = centerMoves[Math.floor(Math.random() * centerMoves.length)];
    } else {
      move = moves[Math.floor(Math.random() * moves.length)];
    }
  }

  return { from: move.from, to: move.to };
}

function MultiplayerPanel({
  roomId,
  playerColor,
  timers,
  onLeave,
}: {
  roomId: string | null;
  playerColor: "w" | "b" | null;
  timers: { white: number; black: number };
  onLeave: () => void;
}) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-800/50 rounded-xl border border-cyan-500/20">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">Room:</span>
        <span className="font-mono text-cyan-400">{roomId || "---"}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className={playerColor === "w" ? "text-cyan-400 font-bold" : "text-zinc-400"}>White</span>
        <span className="font-mono">{formatTime(timers.white)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className={playerColor === "b" ? "text-cyan-400 font-bold" : "text-zinc-400"}>Black</span>
        <span className="font-mono">{formatTime(timers.black)}</span>
      </div>
      {roomId && (
        <button
          onClick={onLeave}
          className="mt-2 px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-all"
        >
          Leave Room
        </button>
      )}
    </div>
  );
}

function ChessGame() {
  const socket = useSocket();
  const [game, setGame] = useState(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  
  // Multiplayer state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<"w" | "b" | null>(null);
  const [timers, setTimers] = useState({ white: 600000, black: 600000 });
  const [joinCode, setJoinCode] = useState("");
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  // Handle URL params for joining via link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    if (code && socket) {
      socket.emit("api:join_room", code);
    }
  }, [socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on("api:room_created", (res: { data: { roomId: string; color: "w" | "b" } }) => {
      setRoomId(res.data.roomId);
      setPlayerColor(res.data.color);
      setIsMultiplayer(true);
      window.history.replaceState({}, "", `?room=${res.data.roomId}`);
    });

    socket.on("api:room_joined", (res: { data: { roomId: string; color: "w" | "b" } }) => {
      setRoomId(res.data.roomId);
      setPlayerColor(res.data.color);
      setIsMultiplayer(true);
    });

    socket.on("api:room_state", (res: { data: { fen: string; timers: { white: number; black: number }; turn: "w" | "b"; color: "w" | "b" } }) => {
      setGame(new Chess(res.data.fen));
      setTimers(res.data.timers);
      setPlayerColor(res.data.color);
      if (res.data.turn === "w") {
        setGameStatus("White to move");
      } else {
        setGameStatus("Black to move");
      }
    });

    socket.on("api:game_over", (res: { data: { winner: string | null; reason: string } }) => {
      if (res.data.winner) {
        const winnerName = res.data.winner === "w" ? "White" : "Black";
        setGameStatus(`${winnerName} wins by ${res.data.reason}!`);
      } else {
        setGameStatus("Draw!");
      }
      setRoomId(null);
      setPlayerColor(null);
      setIsMultiplayer(false);
      window.history.replaceState({}, "", window.location.pathname);
    });

    socket.on("api:error", (res: { error: string }) => {
      alert(res.error);
    });

    return () => {
      socket.off("api:room_created");
      socket.off("api:room_joined");
      socket.off("api:room_state");
      socket.off("api:game_over");
      socket.off("api:error");
    };
  }, [socket]);

  const updateGameState = useCallback((newGame: Chess) => {
    setGame(new Chess(newGame.fen()));
    if (newGame.isCheckmate()) {
      const winner = newGame.turn() === "w" ? "Black" : "White";
      setGameStatus(`Checkmate! ${winner} wins!`);
    } else if (newGame.isDraw()) {
      setGameStatus("Draw!");
    } else if (newGame.isCheck()) {
      setGameStatus("Check!");
    } else {
      setGameStatus("");
    }
  }, []);

  const makeMove = useCallback(
    (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
      // Multiplayer move
      if (isMultiplayer && socket && roomId) {
        socket.emit("api:make_move", { from, to, promotion });
        setSelectedSquare(null);
        setLegalMoves([]);
        return true;
      }
      
      // Single player move
      try {
        const move = game.move({ from: from as Square, to: to as Square, promotion });
        if (move) {
          setSelectedSquare(null);
          setLegalMoves([]);
          updateGameState(game);

          if (!game.isGameOver() && game.turn() === "b") {
            setIsAIThinking(true);
            setTimeout(() => {
              const aiMove = simpleAIMove(game);
              if (aiMove) {
                game.move({ from: aiMove.from as Square, to: aiMove.to as Square });
                updateGameState(game);
              }
              setIsAIThinking(false);
            }, 500);
          }
          return true;
        }
      } catch {
        // Invalid move
      }
      return false;
    },
    [game, updateGameState, isMultiplayer, socket, roomId]
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (isAIThinking) return;
      
      // In multiplayer, only allow moves on your turn
      if (isMultiplayer && playerColor && game.turn() !== playerColor) return;

      if (selectedSquare) {
        const success = makeMove(selectedSquare, square);
        if (!success) {
          const piece = game.get(square as Square);
          if (piece && piece.color === game.turn()) {
            setSelectedSquare(square);
            const moves = game.moves({ square: square as Square, verbose: true });
            setLegalMoves(moves.map((m) => m.to));
          } else {
            setSelectedSquare(null);
            setLegalMoves([]);
          }
        }
      } else {
        const piece = game.get(square as Square);
        if (piece && piece.color === game.turn()) {
          setSelectedSquare(square);
          const moves = game.moves({ square: square as Square, verbose: true });
          setLegalMoves(moves.map((m) => m.to));
        }
      }
    },
    [game, selectedSquare, isAIThinking, makeMove, isMultiplayer, playerColor]
  );

  const resetGame = useCallback(() => {
    setGame(new Chess());
    setSelectedSquare(null);
    setLegalMoves([]);
    setGameStatus("");
    setIsAIThinking(false);
  }, []);

  const createRoom = useCallback(() => {
    if (socket) {
      socket.emit("api:create_room");
    }
  }, [socket]);

  const joinRoom = useCallback(() => {
    if (socket && joinCode.trim()) {
      socket.emit("api:join_room", joinCode.trim().toUpperCase());
      setJoinCode("");
    }
  }, [socket, joinCode]);

  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.emit("api:leave_room");
      setRoomId(null);
      setPlayerColor(null);
      setIsMultiplayer(false);
      resetGame();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [socket, resetGame]);

  return (
    <ConversationProvider>
      <div className="flex flex-col lg:flex-row items-center gap-8 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              {isMultiplayer
                ? playerColor === game.turn()
                  ? "Your turn"
                  : "Opponent's turn"
                : isAIThinking
                ? "AI is thinking..."
                : game.turn() === "w"
                ? "Your turn (White)"
                : "AI's turn (Black)"}
            </h2>
            {!isMultiplayer && (
              <button
                onClick={resetGame}
                className="px-4 py-2 text-sm bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:from-cyan-500/30 hover:to-purple-500/30 transition-all font-semibold"
              >
                New Game
              </button>
            )}
          </div>

          {gameStatus && (
            <div className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 rounded-xl border border-cyan-500/30 font-bold text-lg animate-pulse">
              {gameStatus}
            </div>
          )}

          <ChessBoard
            game={game}
            onMove={makeMove}
            selectedSquare={selectedSquare}
            onSelectSquare={handleSquareClick}
            legalMoves={legalMoves}
          />

          <p className="text-sm text-zinc-500 mt-2">Click pieces to move • Voice commands available</p>
        </div>

        <div className="flex flex-col gap-4">
          {!isMultiplayer && (
            <div className="flex flex-col gap-3 p-4 bg-zinc-800/50 rounded-xl border border-cyan-500/20">
              <h3 className="text-sm font-semibold text-zinc-300">Multiplayer</h3>
              <button
                onClick={createRoom}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:from-cyan-500/30 hover:to-purple-500/30 transition-all font-semibold"
              >
                Create Room
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Room code"
                  maxLength={6}
                  className="flex-1 px-3 py-2 bg-zinc-700/50 text-zinc-200 rounded-lg border border-zinc-600 focus:border-cyan-500 focus:outline-none font-mono"
                />
                <button
                  onClick={joinRoom}
                  disabled={!joinCode.trim()}
                  className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join
                </button>
              </div>
            </div>
          )}

          {isMultiplayer && (
            <MultiplayerPanel
              roomId={roomId}
              playerColor={playerColor}
              timers={timers}
              onLeave={leaveRoom}
            />
          )}

          <AgentPanel game={game} makeMove={makeMove} />
        </div>
      </div>
    </ConversationProvider>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
      <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 mb-8 font-heading tracking-wide">
        VOICE CHESS
      </h1>
      <ChessGame />
    </div>
  );
}
