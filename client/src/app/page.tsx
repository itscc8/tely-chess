"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, Square, PieceSymbol, Color } from "chess.js";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
  useConversationMode,
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
    <div className="grid grid-cols-8 border-2 border-cyan-500/30 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10">
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
                text-2xl sm:text-3xl md:text-4xl transition-all duration-150
                ${isLight ? "bg-zinc-700" : "bg-zinc-800"}
                ${isSelected ? "bg-cyan-500/40 ring-2 ring-cyan-400" : ""}
                ${isLegalMove ? "ring-2 ring-cyan-400/50" : ""}
                hover:bg-cyan-500/20
              `}
            >
              {piece && (
                <span
                  className={`
                    ${piece.color === "w" ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" : "text-zinc-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]"}
                  `}
                >
                  {PIECE_SYMBOLS[piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase()]}
                </span>
              )}
              {isLegalMove && !piece && (
                <span className="w-3 h-3 rounded-full bg-cyan-400/50" />
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

function AgentPanel({ game, makeMove }: { game: Chess; makeMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => boolean }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking, isListening } = useConversationMode();
  const [lastMove, setLastMove] = useState<string | null>(null);

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

  const handleMakeMove = useCallback(
    (params: { from: string; to: string; promotion?: string }) => {
      const { from, to, promotion } = params;
      const success = makeMove(from, to, promotion as "q" | "r" | "b" | "n" | undefined);
      if (success) {
        setLastMove(`${from} to ${to}`);
        return `Move ${from} to ${to} completed successfully.`;
      }
      return `Invalid move: ${from} to ${to}. Please try again.`;
    },
    [makeMove]
  );

  const clientTools = useMemo(
    () => ({
      getBoard: () => getBoardDescription(),
      makeMove: handleMakeMove,
    }),
    [getBoardDescription, handleMakeMove]
  );

  useEffect(() => {
    if (status === "connected") {
      // Send initial board state
    }
  }, [status]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-48 h-48 sm:w-56 sm:h-56">
        <Orb
          agentState={agentState}
          colors={["#22d3ee", "#0891b2"]}
        />
      </div>

      <div className="text-center">
        <p className="text-sm text-zinc-400 mb-2">
          Status: <span className="text-cyan-400">{status}</span>
        </p>
        {lastMove && (
          <p className="text-sm text-zinc-500">Last move: {lastMove}</p>
        )}
      </div>

      {status === "connected" ? (
        <button
          onClick={() => endSession()}
          className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
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
          className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
        >
          Start Voice Agent
        </button>
      )}

      <div className="text-xs text-zinc-500 text-center max-w-xs">
        <p className="mb-1">Voice commands:</p>
        <p>"What's on the board?" - Get board state</p>
        <p>"Move from e2 to e4" - Make a move</p>
      </div>
    </div>
  );
}

function simpleAIMove(game: Chess): { from: string; to: string } | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Prioritize captures and checks
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
    // Random move with slight preference for center control
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
  const [game] = useState(() => new Chess());
  const [, setFen] = useState(game.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);

  const updateGameState = useCallback(() => {
    setFen(game.fen());
    if (game.isCheckmate()) {
      const winner = game.turn() === "w" ? "Black" : "White";
      setGameStatus(`Checkmate! ${winner} wins!`);
    } else if (game.isDraw()) {
      setGameStatus("Draw!");
    } else if (game.isCheck()) {
      setGameStatus("Check!");
    } else {
      setGameStatus("");
    }
  }, [game]);

  const makeMove = useCallback(
    (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => {
      try {
        const move = game.move({ from: from as Square, to: to as Square, promotion });
        if (move) {
          setSelectedSquare(null);
          setLegalMoves([]);
          updateGameState();

          // AI makes a move after player
          if (!game.isGameOver() && game.turn() === "b") {
            setIsAIThinking(true);
            setTimeout(() => {
              const aiMove = simpleAIMove(game);
              if (aiMove) {
                game.move({ from: aiMove.from as Square, to: aiMove.to as Square });
                updateGameState();
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
        // Try to make a move
        const success = makeMove(selectedSquare, square);
        if (!success) {
          // Select new piece if clicked on own piece
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
        // Select piece if it's the current player's turn
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
    game.reset();
    setFen(game.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setGameStatus("");
    setIsAIThinking(false);
  }, [game]);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-xl font-semibold text-cyan-400">
            {isAIThinking ? "AI is thinking..." : game.turn() === "w" ? "Your turn (White)" : "AI's turn (Black)"}
          </h2>
          <button
            onClick={resetGame}
            className="px-3 py-1 text-sm bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
          >
            New Game
          </button>
        </div>

        {gameStatus && (
          <div className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg font-semibold">
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
      </div>

      <ConversationProvider clientTools={{}}>
        <AgentPanel game={game} makeMove={makeMove} />
      </ConversationProvider>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl font-bold text-cyan-400 mb-6">Voice Chess</h1>
      <ChessGame />
    </div>
  );
}
