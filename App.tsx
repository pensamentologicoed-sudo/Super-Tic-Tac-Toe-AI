
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
  const baseStyles = "aspect-square w-full flex items-center justify-center text-5xl font-black rounded-3xl transition-all duration-300 transform active:scale-95";
  const stateStyles = value === null 
    ? "bg-slate-800/30 hover:bg-slate-700/50 cursor-pointer border border-white/5" 
    : isWinningSquare 
      ? "bg-emerald-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.5)] animate-pulse z-10" 
      : "bg-slate-800 text-slate-200 cursor-default border border-slate-700/50";

  const textColor = value === 'X' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]';

  return (
    <button
      className={`${baseStyles} ${stateStyles} ${!isWinningSquare && value ? textColor : ''}`}
      onClick={onClick}
      disabled={disabled || value !== null}
    >
      <span className={value ? "scale-100 opacity-100 transition-all duration-500 ease-out" : "scale-0 opacity-0"}>
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
  
  const prompt = `Você é um mestre estratégico de Jogo da Velha. Você joga como '${aiPlayer}'. 
  Tabuleiro atual: [${boardStr}]. (null/números são casas vazias).
  Analise o melhor movimento para vencer ou bloquear o adversário.
  Responda APENAS um JSON: {"move": índice_de_0_a_8}.`;

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
  const [scores, setScores] = useState(() => {
    const saved = localStorage.getItem('ttt_scores');
    return saved ? JSON.parse(saved) : { X: 0, O: 0, Draws: 0 };
  });

  // Salvar scores sempre que mudarem
  useEffect(() => {
    localStorage.setItem('ttt_scores', JSON.stringify(scores));
  }, [scores]);

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
    if (window.navigator.vibrate) window.navigator.vibrate(15);
    
    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
  }, [board, winner, isXNext, isThinking]);

  useEffect(() => {
    if (gameMode === GameMode.PVE && !isXNext && !winner) {
      const triggerAI = async () => {
        setIsThinking(true);
        // Delay artificial para a IA não parecer instantânea demais
        await new Promise(r => setTimeout(r, 800));
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
      if (window.navigator.vibrate) window.navigator.vibrate([40, 30, 40]);
    }
  }, [winner]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setIsThinking(false);
  };

  const clearScores = () => {
    if (confirm("Deseja zerar o placar histórico?")) {
      const empty = { X: 0, O: 0, Draws: 0 };
      setScores(empty);
      localStorage.setItem('ttt_scores', JSON.stringify(empty));
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-6 px-6 bg-slate-950 text-slate-50 overflow-hidden select-none touch-none">
      <header className="text-center w-full mt-4">
        <h1 className="text-4xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-400 to-rose-400">
          TIC-TAC-TOE AI
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.2em]">Gemini 3 Flash Online</p>
        </div>
      </header>

      <div className="w-full max-w-sm space-y-6">
        {/* Toggle Mode */}
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-xl">
          <button 
            onClick={() => { setGameMode(GameMode.PVE); resetGame(); }} 
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${gameMode === GameMode.PVE ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            vs Gemini
          </button>
          <button 
            onClick={() => { setGameMode(GameMode.PVP); resetGame(); }} 
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${gameMode === GameMode.PVP ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Local PvP
          </button>
        </div>

        {/* Board Container */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-rose-500/20 rounded-[2.8rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
          <div className="relative grid grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-sm">
            {board.map((sq, i) => (
              <Square 
                key={i} 
                value={sq} 
                onClick={() => handleClick(i)} 
                isWinningSquare={winningLine?.includes(i) || false} 
                disabled={!!winner || isThinking} 
              />
            ))}
          </div>

          {/* Status Badge */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[200px]">
            <div className="bg-slate-900 border border-slate-700/50 px-5 py-2.5 rounded-full shadow-2xl text-center backdrop-blur-md">
              {isThinking ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider ml-1">Processando</span>
                </div>
              ) : winner ? (
                <span className={`text-[10px] font-black uppercase tracking-wider ${winner === 'Draw' ? 'text-slate-300' : 'text-emerald-400'}`}>
                  {winner === 'Draw' ? 'Empate Técnico' : `Vencedor: ${winner}`}
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Turno: <span className={isXNext ? 'text-cyan-400' : 'text-rose-400'}>{isXNext ? 'X' : 'O'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Score Board */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/40 p-3 rounded-3xl border border-slate-800/30 text-center">
            <div className="text-[8px] text-cyan-500 font-black mb-1 uppercase tracking-tighter">Vitórias X</div>
            <div className="text-xl font-black">{scores.X}</div>
          </div>
          <div className="bg-slate-900/40 p-3 rounded-3xl border border-slate-800/30 text-center">
            <div className="text-[8px] text-slate-500 font-black mb-1 uppercase tracking-tighter">Empates</div>
            <div className="text-xl font-black">{scores.Draws}</div>
          </div>
          <div className="bg-slate-900/40 p-3 rounded-3xl border border-slate-800/30 text-center">
            <div className="text-[8px] text-rose-500 font-black mb-1 uppercase tracking-tighter">Vitórias O</div>
            <div className="text-xl font-black">{scores.O}</div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <footer className="w-full max-w-sm flex flex-col gap-3 mb-4">
        <button 
          onClick={resetGame} 
          className="w-full py-4.5 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.2em] rounded-2xl active:scale-95 transition-all shadow-xl shadow-white/10"
        >
          Nova Partida
        </button>
        <button 
          onClick={clearScores} 
          className="w-full py-2 text-[8px] text-slate-600 font-bold uppercase tracking-widest hover:text-slate-400 transition-colors"
        >
          Limpar Histórico
        </button>
      </footer>
    </div>
  );
};

export default App;
