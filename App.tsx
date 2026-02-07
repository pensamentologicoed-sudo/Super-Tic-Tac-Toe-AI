
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TIPOS ---
type Player = 'X' | 'O';
type SquareValue = Player | null;
enum GameMode { PVP = 'PVP', PVE = 'PVE' }

// --- COMPONENTE SQUARE ---
interface SquareProps {
  value: SquareValue;
  onClick: () => void;
  isWinningSquare: boolean;
  disabled: boolean;
}

const Square: React.FC<SquareProps> = ({ value, onClick, isWinningSquare, disabled }) => {
  const baseStyles = "aspect-square w-full flex items-center justify-center text-5xl font-black rounded-3xl transition-all duration-300 transform active:scale-90";
  const stateStyles = value === null 
    ? "bg-slate-800/40 hover:bg-slate-700/60 cursor-pointer border border-white/5" 
    : isWinningSquare 
      ? "bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse z-10" 
      : "bg-slate-800 text-slate-200 cursor-default border border-slate-700/50";

  const textColor = value === 'X' ? 'text-cyan-400' : 'text-rose-400';

  return (
    <button
      className={`${baseStyles} ${stateStyles} ${!isWinningSquare && value ? textColor : ''}`}
      onClick={onClick}
      disabled={disabled || value !== null}
    >
      <span className={value ? "scale-100 opacity-100 transition-all duration-500" : "scale-0 opacity-0"}>
        {value}
      </span>
    </button>
  );
};

// --- SERVIÇO IA (GEMINI) ---
const getAIMove = async (board: SquareValue[], aiPlayer: Player): Promise<number> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    if (board[4] === null) return 4;
    return board.findIndex(val => val === null);
  }

  const ai = new GoogleGenAI({ apiKey });
  const boardStr = board.map((val, idx) => val === null ? idx : val).join(', ');
  
  const prompt = `Você é um mestre de Jogo da Velha jogando como '${aiPlayer}'. 
  Tabuleiro atual: [${boardStr}]. (null/números são casas vazias).
  Escolha a melhor jogada estratégica. Responda apenas o JSON com o índice (0-8).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            move: { type: Type.INTEGER, description: "O índice da jogada (0-8)." }
          },
          required: ["move"]
        }
      }
    });

    const json = JSON.parse(response.text.trim());
    const move = json.move;
    if (typeof move === 'number' && move >= 0 && move <= 8 && board[move] === null) return move;
    return board.findIndex(val => val === null);
  } catch (e) {
    return board.findIndex(val => val === null);
  }
};

// --- APP PRINCIPAL ---
const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
];

const App: React.FC = () => {
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.PVE);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [scores, setScores] = useState({ X: 0, O: 0, Draws: 0 });

  const checkWinner = (squares: SquareValue[]) => {
    for (const [a, b, c] of WINNING_COMBINATIONS) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a] as Player, line: [a, b, c] };
      }
    }
    return squares.every(sq => sq !== null) ? { winner: 'Draw' as const, line: null } : null;
  };

  const result = checkWinner(board);
  const winner = result?.winner || null;
  const winningLine = result?.line || null;

  const handleClick = useCallback((index: number) => {
    if (board[index] || winner || isThinking) return;
    if (window.navigator.vibrate) window.navigator.vibrate(10);
    
    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
  }, [board, winner, isXNext, isThinking]);

  useEffect(() => {
    if (gameMode === GameMode.PVE && !isXNext && !winner) {
      const triggerAI = async () => {
        setIsThinking(true);
        await new Promise(r => setTimeout(r, 600));
        const move = await getAIMove(board, 'O');
        setIsThinking(false);
        if (move !== -1) handleClick(move);
      };
      triggerAI();
    }
  }, [isXNext, gameMode, winner, board, handleClick]);

  useEffect(() => {
    if (winner) {
      if (winner === 'X') setScores(s => ({ ...s, X: s.X + 1 }));
      else if (winner === 'O') setScores(s => ({ ...s, O: s.O + 1 }));
      else setScores(s => ({ ...s, Draws: s.Draws + 1 }));
      if (window.navigator.vibrate) window.navigator.vibrate(50);
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
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Powered by Gemini 3 Flash</p>
      </header>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/50 backdrop-blur-md">
          <button onClick={() => { setGameMode(GameMode.PVE); resetGame(); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${gameMode === GameMode.PVE ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>vs Gemini</button>
          <button onClick={() => { setGameMode(GameMode.PVP); resetGame(); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${gameMode === GameMode.PVP ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-50'}`}>PvP</button>
        </div>

        <div className="relative">
          <div className="grid grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            {board.map((sq, i) => (
              <Square key={i} value={sq} onClick={() => handleClick(i)} isWinningSquare={winningLine?.includes(i) || false} disabled={!!winner || isThinking} />
            ))}
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[180px]">
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-full shadow-2xl text-center">
              {isThinking ? <span className="text-[9px] font-black uppercase text-indigo-400 animate-pulse">Gemini pensando...</span> : 
               winner ? <span className="text-[9px] font-black uppercase text-emerald-400">{winner === 'Draw' ? 'Empate!' : `Vitória: ${winner}`}</span> :
               <span className="text-[9px] font-black uppercase text-slate-400">Vez de: <span className={isXNext ? 'text-cyan-400' : 'text-rose-400'}>{isXNext ? 'X' : 'O'}</span></span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/60 p-3 rounded-3xl border border-slate-800/50 text-center"><div className="text-[7px] text-cyan-500 font-black mb-1 uppercase">X</div><div className="text-lg font-black">{scores.X}</div></div>
          <div className="bg-slate-900/60 p-3 rounded-3xl border border-slate-800/50 text-center"><div className="text-[7px] text-slate-500 font-black mb-1 uppercase">Draw</div><div className="text-lg font-black">{scores.Draws}</div></div>
          <div className="bg-slate-900/60 p-3 rounded-3xl border border-slate-800/50 text-center"><div className="text-[7px] text-rose-500 font-black mb-1 uppercase">O</div><div className="text-lg font-black">{scores.O}</div></div>
        </div>
      </div>

      <footer className="w-full max-w-sm flex flex-col gap-4">
        <button onClick={resetGame} className="w-full py-5 bg-white text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-transform">Reiniciar Partida</button>
      </footer>
    </div>
  );
};

export default App;
