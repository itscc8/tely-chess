"use client";

import { useCallback, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
  useConversationClientTool,
} from "@elevenlabs/react";
import { Orb } from "@/components/ui/orb";

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

function ChessGame() {
  const [game, setGame] = useState(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);

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
    [game, updateGameState]
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (isAIThinking) return;

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
    [game, selectedSquare, isAIThinking, makeMove]
  );

  const resetGame = useCallback(() => {
    setGame(new Chess());
    setSelectedSquare(null);
    setLegalMoves([]);
    setGameStatus("");
    setIsAIThinking(false);
  }, []);

  return (
    <ConversationProvider>
      <div className="flex flex-col lg:flex-row items-center gap-8 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              {isAIThinking ? "AI is thinking..." : game.turn() === "w" ? "Your turn (White)" : "AI's turn (Black)"}
            </h2>
            <button
              onClick={resetGame}
              className="px-4 py-2 text-sm bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:from-cyan-500/30 hover:to-purple-500/30 transition-all font-semibold"
            >
              New Game
            </button>
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

        <AgentPanel game={game} makeMove={makeMove} />
      </div>
    </ConversationProvider>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
      <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 mb-8 font-heading tracking-wide">
        VOICE CHESS
      </h1>
      <ChessGame />
    </div>
  );
}
