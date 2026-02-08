
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TIPOS ---
type Player = 'X' | 'O';
type SquareValue = Player | null;
enum GameMode { PVP = 'PVP', PVE = 'PVE' }
enum Difficulty { EASY = 'EASY', NORMAL = 'NORMAL', NEURAL = 'NEURAL' }

// --- COMPONENTE SQUARE ---
interface SquareProps {
  value: SquareValue;
  onClick: () => void;
  isWinningSquare: boolean;
  isGameOver: boolean;
  disabled: boolean;
}

const Square: React.FC<SquareProps> = ({ value, onClick, isWinningSquare, isGameOver, disabled }) => {
  const baseStyles = "aspect-square w-full flex items-center justify-center text-5xl font-black rounded-[1.8rem] transition-all duration-300 transform active:scale-90 select-none";
  
  const stateStyles = value === null 
    ? "bg-slate-800/10 hover:bg-slate-700/30 cursor-pointer border border-white/5" 
    : isWinningSquare 
      ? "bg-emerald-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.7)] z-20 scale-105 animate-[pulse_1.5s_infinite]" 
      : `bg-slate-800/60 text-slate-200 cursor-default border border-slate-700/50 ${isGameOver ? 'opacity-30' : ''}`;

  const textColor = value === 'X' 
    ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]' 
    : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.6)]';

  return (
    <button
      className={`${baseStyles} ${stateStyles} ${!isWinningSquare && value ? textColor : ''}`}
      onClick={onClick}
      disabled={disabled || value !== null}
    >
      <span className={`inline-block transition-all duration-500 ${value ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-45 opacity-0"}`}>
        {value}
      </span>
    </button>
  );
};

// --- SERVIÇO IA (GEMINI) ---
const getAIMove = async (board: SquareValue[], aiPlayer: Player, difficulty: Difficulty): Promise<number> => {
  const availableMoves = board.map((val, idx) => val === null ? idx : -1).filter(idx => idx !== -1);
  const getRandomMove = () => availableMoves[Math.floor(Math.random() * availableMoves.length)];

  if (difficulty === Difficulty.EASY) return getRandomMove();
  if (difficulty === Difficulty.NORMAL && Math.random() > 0.5) return getRandomMove();

  const apiKey = process.env.API_KEY;
  if (!apiKey) return getRandomMove();

  const ai = new GoogleGenAI({ apiKey });
  const boardStr = board.map((val, idx) => val === null ? idx : val).join(', ');
  
  const prompt = `Você é o mestre invencível do Jogo da Velha. Jogue como '${aiPlayer}'. 
  Tabuleiro atual: [${boardStr}].
  Analise estrategicamente e vença. Responda APENAS um JSON: {"move": índice_de_0_a_8}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { move: { type: Type.INTEGER } },
          required: ["move"]
        }
      }
    });

    const json = JSON.parse(response.text.trim());
    const move = json.move;
    if (typeof move === 'number' && board[move] === null) return move;
    return getRandomMove();
  } catch (e) {
    return getRandomMove();
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
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [scores, setScores] = useState(() => {
    const saved = localStorage.getItem('ttt_scores_v2');
    return saved ? JSON.parse(saved) : { X: 0, O: 0, Draws: 0 };
  });

  useEffect(() => {
    localStorage.setItem('ttt_scores_v2', JSON.stringify(scores));
  }, [scores]);

  const checkWinner = useMemo(() => {
    for (const [a, b, c] of WINNING_COMBINATIONS) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a] as Player, line: [a, b, c] };
      }
    }
    return board.every(sq => sq !== null) ? { winner: 'Draw' as const, line: null } : null;
  }, [board]);

  const winner = checkWinner?.winner || null;
  const winningLine = checkWinner?.line || null;

  const handleClick = useCallback((index: number) => {
    if (board[index] || winner || isThinking) return;
    if (window.navigator.vibrate) window.navigator.vibrate(25);
    
    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
  }, [board, winner, isXNext, isThinking]);

  useEffect(() => {
    if (gameMode === GameMode.PVE && !isXNext && !winner) {
      const triggerAI = async () => {
        setIsThinking(true);
        const delay = Math.floor(Math.random() * (600 - 300 + 1)) + 300;
        await new Promise(r => setTimeout(r, delay));
        const move = await getAIMove(board, 'O', difficulty);
        setIsThinking(false);
        if (move !== -1) handleClick(move);
      };
      triggerAI();
    }
  }, [isXNext, gameMode, winner, board, handleClick, difficulty]);

  useEffect(() => {
    if (winner) {
      if (winner === 'X') setScores(s => ({ ...s, X: s.X + 1 }));
      else if (winner === 'O') setScores(s => ({ ...s, O: s.O + 1 }));
      else setScores(s => ({ ...s, Draws: s.Draws + 1 }));
      if (window.navigator.vibrate) window.navigator.vibrate([100, 80, 100]);
    }
  }, [winner]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setIsThinking(false);
  };

  const resetAll = () => {
    if (window.confirm("Isso irá zerar o placar e reiniciar o jogo. Continuar?")) {
      setScores({ X: 0, O: 0, Draws: 0 });
      localStorage.removeItem('ttt_scores_v2');
      resetGame();
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-8 px-6 bg-[#020617] text-slate-50 overflow-hidden select-none">
      <header className="text-center w-full space-y-1">
        <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500 italic">
          TIC·TAC·TOE
        </h1>
        <div className="flex items-center justify-center gap-1.5 opacity-40">
          <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-amber-400 animate-bounce' : 'bg-emerald-400'}`}></div>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
            {isThinking ? "Neural Link Processando..." : "Sistema Online"}
          </span>
        </div>
      </header>

      <main className="w-full max-w-xs flex flex-col gap-5">
        {/* Controles: Modo, Dificuldade e Status */}
        <div className="space-y-4">
          <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => { setGameMode(GameMode.PVE); resetGame(); }} 
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${gameMode === GameMode.PVE ? 'bg-white text-black shadow-lg' : 'text-slate-500'}`}
            >
              vs IA
            </button>
            <button 
              onClick={() => { setGameMode(GameMode.PVP); resetGame(); }} 
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${gameMode === GameMode.PVP ? 'bg-white text-black shadow-lg' : 'text-slate-500'}`}
            >
              Amigo
            </button>
          </div>

          {gameMode === GameMode.PVE && (
            <div className="flex justify-between gap-1 px-1">
              {(['EASY', 'NORMAL', 'NEURAL'] as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => { setDifficulty(diff); resetGame(); }}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase border transition-all ${difficulty === diff ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' : 'border-transparent text-slate-600'}`}
                >
                  {diff === 'EASY' ? 'Fácil' : diff === 'NORMAL' ? 'Médio' : 'Neural'}
                </button>
              ))}
            </div>
          )}

          {/* INDICADOR DE TURNO / STATUS */}
          <div className="flex justify-center w-full min-h-[40px] items-center">
            <div className={`px-6 py-2 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-wider transition-all duration-500 flex flex-col items-center ${winner ? 'bg-emerald-500 text-white scale-105' : 'bg-white/5 border border-white/10 text-white'}`}>
              {isThinking ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  IA PENSANDO...
                </span>
              ) : winner ? (
                <div className="text-center">
                  <div className="leading-tight">{winner === 'Draw' ? "Empate Técnico" : `Vencedor: ${winner}`}</div>
                  {winner === 'Draw' && <div className="text-[7px] opacity-70 font-bold tracking-normal">Ninguém conseguiu vencer</div>}
                </div>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isXNext ? 'bg-cyan-500' : 'bg-rose-500'}`}></span>
                  👉 Vez do jogador: {isXNext ? 'X' : 'O'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-6 bg-gradient-to-tr from-cyan-500/10 to-rose-500/10 rounded-[3rem] blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-[2.2rem] border border-white/10 backdrop-blur-2xl relative z-10">
            {board.map((sq, i) => (
              <Square 
                key={i} 
                value={sq} 
                onClick={() => handleClick(i)} 
                isWinningSquare={winningLine?.includes(i) || false} 
                isGameOver={!!winner}
                disabled={!!winner || isThinking} 
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-2">
          <div className="bg-slate-900/40 py-3 rounded-2xl border border-white/5 text-center">
            <div className="text-[8px] font-bold text-cyan-400 uppercase tracking-tighter opacity-70">Jogador X</div>
            <div className="text-xl font-black">{scores.X}</div>
          </div>
          <div className="bg-slate-900/40 py-3 rounded-2xl border border-white/5 text-center opacity-40">
            <div className="text-[8px] font-bold uppercase tracking-tighter">Empates</div>
            <div className="text-xl font-black">{scores.Draws}</div>
          </div>
          <div className="bg-slate-900/40 py-3 rounded-2xl border border-white/5 text-center">
            <div className="text-[8px] font-bold text-rose-400 uppercase tracking-tighter opacity-70">Oponente O</div>
            <div className="text-xl font-black">{scores.O}</div>
          </div>
        </div>
      </main>

      {/* RODAPÉ COM DOIS BOTÕES */}
      <footer className="w-full max-w-xs flex flex-col gap-2">
        <button 
          onClick={resetGame} 
          className="w-full py-4 bg-white hover:bg-slate-200 text-black font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-xl transition-all active:scale-95"
        >
          {winner ? "Nova Partida" : "Reiniciar Jogo"}
        </button>
        <button 
          onClick={resetAll} 
          className="w-full py-2.5 bg-slate-900/40 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 font-bold text-[9px] uppercase tracking-[0.2em] rounded-xl transition-all active:scale-95"
        >
          Zerar Tudo
        </button>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1.05); filter: brightness(1) drop-shadow(0 0 20px rgba(16,185,129,0.5)); }
          50% { transform: scale(1.08); filter: brightness(1.3) drop-shadow(0 0 40px rgba(16,185,129,0.8)); }
        }
      `}</style>
    </div>
  );
};

export default App;
