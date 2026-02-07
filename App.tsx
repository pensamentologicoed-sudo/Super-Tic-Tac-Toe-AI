
import React, { useState, useEffect, useCallback } from 'react';
import Square from './components/Square';
import { Player, SquareValue, GameMode, GameState } from './types';
import { getAIMove } from './services/geminiService';

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

const App: React.FC = () => {
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.PVE);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [scores, setScores] = useState({ X: 0, O: 0, Draws: 0 });

  const checkWinner = (squares: SquareValue[]) => {
    for (let i = 0; i < WINNING_COMBINATIONS.length; i++) {
      const [a, b, c] = WINNING_COMBINATIONS[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a] as Player, line: [a, b, c] };
      }
    }
    if (squares.every(sq => sq !== null)) {
      return { winner: 'Draw' as const, line: null };
    }
    return null;
  };

  const currentResult = checkWinner(board);
  const winner = currentResult?.winner || null;
  const winningLine = currentResult?.line || null;

  const handleClick = useCallback((index: number) => {
    if (board[index] || winner || isThinking) return;

    // Feedback tátil simples se disponível
    if (window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }

    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
  }, [board, winner, isXNext, isThinking]);

  // AI Logic
  useEffect(() => {
    if (gameMode === GameMode.PVE && !isXNext && !winner) {
      const triggerAIMove = async () => {
        setIsThinking(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        const move = await getAIMove(board, 'O');
        setIsThinking(false);
        if (move !== -1) {
          handleClick(move);
        }
      };
      triggerAIMove();
    }
  }, [isXNext, gameMode, winner, board, handleClick]);

  useEffect(() => {
    if (winner) {
      if (winner === 'X') setScores(prev => ({ ...prev, X: prev.X + 1 }));
      else if (winner === 'O') setScores(prev => ({ ...prev, O: prev.O + 1 }));
      else setScores(prev => ({ ...prev, Draws: prev.Draws + 1 }));
      
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }
  }, [winner]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setIsThinking(false);
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-8 px-6 bg-slate-950 text-slate-50 overflow-hidden">
      <header className="text-center w-full">
        <h1 className="text-4xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 via-indigo-400 to-rose-400 mb-1">
          TIC-TAC-TOE AI
        </h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Powered by Gemini 3</p>
      </header>

      <div className="w-full max-w-sm space-y-6">
        {/* Mode Selector */}
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/50 backdrop-blur-md">
          <button 
            onClick={() => { setGameMode(GameMode.PVE); resetGame(); }}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${gameMode === GameMode.PVE ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
          >
            vs Gemini
          </button>
          <button 
            onClick={() => { setGameMode(GameMode.PVP); resetGame(); }}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${gameMode === GameMode.PVP ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
          >
            PvP
          </button>
        </div>

        {/* Board Area */}
        <div className="relative group">
          <div className="grid grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-sm">
            {board.map((square, i) => (
              <Square 
                key={i} 
                value={square} 
                onClick={() => handleClick(i)}
                isWinningSquare={winningLine?.includes(i) || false}
                disabled={!!winner || isThinking}
              />
            ))}
          </div>

          {/* Floating Status */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[200px]">
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-full shadow-2xl text-center">
              {isThinking ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-tighter text-indigo-400">Processando...</span>
                </div>
              ) : winner ? (
                <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-400">
                  {winner === 'Draw' ? 'Empate!' : `Vitória: ${winner}`}
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                  Vez de: <span className={isXNext ? 'text-cyan-400' : 'text-rose-400'}>{isXNext ? 'X' : 'O'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scoreboard Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800/50 text-center">
            <div className="text-[8px] text-cyan-500 font-black uppercase mb-1">X</div>
            <div className="text-xl font-black">{scores.X}</div>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800/50 text-center">
            <div className="text-[8px] text-slate-500 font-black uppercase mb-1">Draw</div>
            <div className="text-xl font-black">{scores.Draws}</div>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800/50 text-center">
            <div className="text-[8px] text-rose-500 font-black uppercase mb-1">O</div>
            <div className="text-xl font-black">{scores.O}</div>
          </div>
        </div>
      </div>

      {/* Action Area */}
      <footer className="w-full max-w-sm flex flex-col gap-4">
        <button 
          onClick={resetGame}
          className="w-full py-5 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 transition-transform"
        >
          Reiniciar Partida
        </button>
        <p className="text-[8px] text-center text-slate-600 font-bold uppercase tracking-[0.5em]">
          Tic Tac Toe • Gemini AI v3
        </p>
      </footer>
    </div>
  );
};

export default App;
