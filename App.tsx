
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TIPOS ---
type Player = 'X' | 'O';
type SquareValue = Player | null;
enum GameMode { PVP = 'PVP', PVE = 'PVE' }
enum Difficulty { EASY = 'EASY', NORMAL = 'NORMAL', NEURAL = 'NEURAL' }

// --- CONSTANTES ---
const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
];

// --- AUXILIARES DE JOGO ---
const checkWinnerRaw = (board: SquareValue[]) => {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(s => s !== null)) return 'Draw';
  return null;
};

// --- ALGORITMO MINIMAX (PARA NÍVEL IMPOSSÍVEL) ---
const minimax = (board: SquareValue[], depth: number, isMaximizing: boolean, aiPlayer: Player): number => {
  const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
  const result = checkWinnerRaw(board);

  if (result === aiPlayer) return 10 - depth;
  if (result === humanPlayer) return depth - 10;
  if (result === 'Draw') return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiPlayer;
        let score = minimax(board, depth + 1, false, aiPlayer);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanPlayer;
        let score = minimax(board, depth + 1, true, aiPlayer);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
};

const getBestMoveMinimax = (board: SquareValue[], aiPlayer: Player): number => {
  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = aiPlayer;
      let score = minimax(board, 0, false, aiPlayer);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
};

// --- LOGICA ESTRATÉGICA (MÉDIO) ---
const getStrategicMove = (board: SquareValue[], aiPlayer: Player): number => {
  const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
  // Vencer
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] === aiPlayer && board[b] === aiPlayer && board[c] === null) return c;
    if (board[a] === aiPlayer && board[c] === aiPlayer && board[b] === null) return b;
    if (board[b] === aiPlayer && board[c] === aiPlayer && board[a] === null) return a;
  }
  // Bloquear
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] === humanPlayer && board[b] === humanPlayer && board[c] === null) return c;
    if (board[a] === humanPlayer && board[c] === humanPlayer && board[b] === null) return b;
    if (board[b] === humanPlayer && board[c] === humanPlayer && board[a] === null) return a;
  }
  // Centro
  if (board[4] === null) return 4;
  // Aleatório entre disponíveis
  const available = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
  return available[Math.floor(Math.random() * available.length)];
};

// --- SERVIÇO IA (GEMINI + FALLBACK MINIMAX) ---
const getAIMove = async (board: SquareValue[], aiPlayer: Player, difficulty: Difficulty): Promise<number> => {
  const available = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
  if (available.length === 0) return -1;

  if (difficulty === Difficulty.EASY) {
    return available[Math.floor(Math.random() * available.length)];
  }

  if (difficulty === Difficulty.NORMAL) {
    return getStrategicMove(board, aiPlayer);
  }

  // NÍVEL NEURAL / IMPOSSÍVEL
  const apiKey = process.env.API_KEY;
  if (!apiKey) return getBestMoveMinimax([...board], aiPlayer);

  const ai = new GoogleGenAI({ apiKey });
  const boardStr = board.map((val, idx) => val === null ? idx : val).join(', ');
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é uma IA perfeita de Jogo da Velha (O). Tabuleiro: [${boardStr}]. 
      Analise todas as possibilidades e responda o índice (0-8) da jogada que garante que você nunca perca. 
      Responda apenas JSON: {"move": número}.`,
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
    return getBestMoveMinimax([...board], aiPlayer);
  } catch (e) {
    return getBestMoveMinimax([...board], aiPlayer);
  }
};

// --- COMPONENTES UI ---
const Square: React.FC<{ value: SquareValue, onClick: () => void, isWinningSquare: boolean, isGameOver: boolean, disabled: boolean }> = ({ value, onClick, isWinningSquare, isGameOver, disabled }) => {
  const baseStyles = "aspect-square w-full flex items-center justify-center text-5xl font-black rounded-[1.8rem] transition-all duration-300 transform active:scale-90 select-none";
  const stateStyles = value === null 
    ? "bg-slate-800/10 hover:bg-slate-700/30 cursor-pointer border border-white/5" 
    : isWinningSquare 
      ? "bg-emerald-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.7)] scale-105 animate-[pulse_1.5s_infinite]" 
      : `bg-slate-800/60 text-slate-200 border border-slate-700/50 ${isGameOver ? 'opacity-30' : ''}`;

  return (
    <button className={`${baseStyles} ${stateStyles} ${value === 'X' ? 'text-cyan-400' : 'text-rose-400'}`} onClick={onClick} disabled={disabled || value !== null}>
      <span className={`transition-all duration-500 ${value ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}>{value}</span>
    </button>
  );
};

const App: React.FC = () => {
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [gameMode, setGameMode] = useState(GameMode.PVE);
  const [difficulty, setDifficulty] = useState(Difficulty.NORMAL);
  const [isThinking, setIsThinking] = useState(false);
  const [scores, setScores] = useState(() => JSON.parse(localStorage.getItem('ttt_scores_v3') || '{"X":0,"O":0,"Draws":0}'));

  useEffect(() => localStorage.setItem('ttt_scores_v3', JSON.stringify(scores)), [scores]);

  const checkWinner = useMemo(() => {
    for (const [a, b, c] of WINNING_COMBINATIONS) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: [a, b, c] };
    }
    return board.every(s => s !== null) ? { winner: 'Draw', line: null } : null;
  }, [board]);

  const winner = checkWinner?.winner || null;

  const handleClick = useCallback((i: number) => {
    if (board[i] || winner || isThinking) return;
    const nextBoard = [...board];
    nextBoard[i] = isXNext ? 'X' : 'O';
    setBoard(nextBoard);
    setIsXNext(!isXNext);
  }, [board, winner, isThinking, isXNext]);

  useEffect(() => {
    if (gameMode === GameMode.PVE && !isXNext && !winner) {
      (async () => {
        setIsThinking(true);
        const move = await getAIMove(board, 'O', difficulty);
        await new Promise(r => setTimeout(r, 600));
        setIsThinking(false);
        if (move !== -1) handleClick(move);
      })();
    }
  }, [isXNext, gameMode, winner, board, difficulty, handleClick]);

  useEffect(() => {
    if (winner) {
      setScores((s: any) => ({ ...s, [winner === 'Draw' ? 'Draws' : winner]: s[winner === 'Draw' ? 'Draws' : winner] + 1 }));
    }
  }, [winner]);

  const resetGame = () => { setBoard(Array(9).fill(null)); setIsXNext(true); setIsThinking(false); };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-8 px-6 bg-[#020617] text-slate-50 overflow-hidden select-none">
      <header className="text-center w-full space-y-1">
        <h1 className="text-3xl font-black italic bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">TIC·TAC·TOE</h1>
        <div className="flex items-center justify-center gap-1.5 opacity-40">
          <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-amber-400 animate-bounce' : 'bg-emerald-400'}`}></div>
          <span className="text-[9px] font-bold uppercase tracking-widest">{isThinking ? "Processamento Neural..." : "Sistema Online"}</span>
        </div>
      </header>

      <main className="w-full max-w-xs flex flex-col gap-6">
        <div className="space-y-4">
          <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5">
            {[GameMode.PVE, GameMode.PVP].map(m => (
              <button key={m} onClick={() => { setGameMode(m); resetGame(); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${gameMode === m ? 'bg-white text-black' : 'text-slate-500'}`}>
                {m === GameMode.PVE ? 'vs IA' : 'Amigo'}
              </button>
            ))}
          </div>

          {gameMode === GameMode.PVE && (
            <div className="flex justify-between gap-1">
              {[Difficulty.EASY, Difficulty.NORMAL, Difficulty.NEURAL].map(d => (
                <button key={d} onClick={() => { setDifficulty(d); resetGame(); }} className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold uppercase border transition-all ${difficulty === d ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' : 'border-transparent text-slate-600'}`}>
                  {d === 'EASY' ? 'Fácil' : d === 'NORMAL' ? 'Médio' : 'Neural'}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center min-h-[40px] items-center">
            <div className={`px-6 py-2 rounded-full font-black text-[10px] uppercase transition-all ${winner ? 'bg-emerald-500 text-white' : 'bg-white/5 border border-white/10'}`}>
              {isThinking ? "IA Pensando..." : winner ? (winner === 'Draw' ? "Empate" : `Vitória: ${winner}`) : `Vez de: ${isXNext ? 'X' : 'O'}`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-[2.2rem] border border-white/10 relative">
          <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/10 to-rose-500/10 rounded-[3rem] blur-2xl -z-10 opacity-50"></div>
          {board.map((sq, i) => (
            <Square key={i} value={sq} onClick={() => handleClick(i)} isWinningSquare={checkWinner?.line?.includes(i) || false} isGameOver={!!winner} disabled={!!winner || isThinking} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {['X', 'Draws', 'O'].map(k => (
            <div key={k} className="bg-slate-900/40 py-3 rounded-2xl border border-white/5">
              <div className={`text-[8px] font-bold uppercase ${k === 'X' ? 'text-cyan-400' : k === 'O' ? 'text-rose-400' : 'text-slate-500'}`}>{k === 'Draws' ? 'Empates' : `Jogador ${k}`}</div>
              <div className="text-xl font-black">{scores[k]}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full max-w-xs flex flex-col gap-2">
        <button onClick={resetGame} className="w-full py-4 bg-white text-black font-black text-[11px] uppercase tracking-widest rounded-2xl">Nova Partida</button>
        <button onClick={() => { if(confirm("Zerar tudo?")) { setScores({X:0,O:0,Draws:0}); localStorage.removeItem('ttt_scores_v3'); resetGame(); } }} className="w-full py-2 text-slate-500 font-bold text-[9px] uppercase">Zerar Placar</button>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1.05); } 50% { transform: scale(1.08); filter: brightness(1.2); } }
      `}</style>
    </div>
  );
};

export default App;
