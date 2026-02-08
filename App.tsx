
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Player, SquareValue, GameMode, Difficulty, Scores, GameMove } from './types';
import { WINNING_COMBINATIONS } from './game/gameLogic';
import { getAIMove } from './ai/ticTacToeAI';
import Board from './ui/Board';
import StatusBar from './ui/StatusBar';
import ReplayControls from './ui/ReplayControls';

const App: React.FC = () => {
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [gameMode, setGameMode] = useState(GameMode.PVE);
  const [difficulty, setDifficulty] = useState(Difficulty.NORMAL);
  const [isThinking, setIsThinking] = useState(false);
  
  // Estados de Histórico e Replay
  const [currentHistory, setCurrentHistory] = useState<GameMove[]>([]);
  const [lastMatchHistory, setLastMatchHistory] = useState<GameMove[] | null>(null);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  const [scores, setScores] = useState<Scores>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('ttt_scores_v4') : null;
      return saved ? JSON.parse(saved) : { X: 0, O: 0, Draws: 0 };
    } catch {
      return { X: 0, O: 0, Draws: 0 };
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ttt_scores_v4', JSON.stringify(scores));
    }
  }, [scores]);

  const checkWinner = useMemo(() => {
    for (const [a, b, c] of WINNING_COMBINATIONS) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a] as Player, line: [a, b, c] };
      }
    }
    return board.every(s => s !== null) ? { winner: 'Draw' as const, line: null } : null;
  }, [board]);

  const winner = checkWinner?.winner || null;
  const winningLine = checkWinner?.line || null;

  const handleClick = useCallback((i: number) => {
    if (board[i] || winner || isThinking || replayIndex !== null) return;
    
    const currentPlayer = isXNext ? 'X' : 'O';
    const nextBoard = [...board];
    nextBoard[i] = currentPlayer;
    
    setBoard(nextBoard);
    setCurrentHistory(prev => [...prev, { index: i, player: currentPlayer }]);
    setIsXNext(!isXNext);
  }, [board, winner, isThinking, isXNext, replayIndex]);

  useEffect(() => {
    if (gameMode === GameMode.PVE && !isXNext && !winner && replayIndex === null) {
      let isMounted = true;
      (async () => {
        setIsThinking(true);
        const move = await getAIMove(board, 'O', difficulty);
        await new Promise(r => setTimeout(r, 600));
        if (isMounted) {
          setIsThinking(false);
          if (move !== -1) handleClick(move);
        }
      })();
      return () => { isMounted = false; };
    }
  }, [isXNext, gameMode, winner, board, difficulty, handleClick, replayIndex]);

  useEffect(() => {
    if (winner) {
      setScores(prev => {
        const key = winner === 'Draw' ? 'Draws' : winner;
        return { ...prev, [key]: prev[key] + 1 };
      });
      setLastMatchHistory(currentHistory);
    }
  }, [winner, currentHistory]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setIsThinking(false);
    setCurrentHistory([]);
    setReplayIndex(null);
  };

  const startReplay = () => {
    if (!lastMatchHistory) return;
    setReplayIndex(0);
    setBoard(Array(9).fill(null));
  };

  const navigateReplay = (direction: 'next' | 'prev') => {
    if (replayIndex === null || !lastMatchHistory) return;
    
    let nextIdx = replayIndex;
    if (direction === 'next' && replayIndex < lastMatchHistory.length) {
      nextIdx++;
    } else if (direction === 'prev' && replayIndex > 0) {
      nextIdx--;
    }

    if (nextIdx === replayIndex) return;

    const newBoard: SquareValue[] = Array(9).fill(null);
    for (let i = 0; i < nextIdx; i++) {
      const move = lastMatchHistory[i];
      newBoard[move.index] = move.player;
    }
    
    setBoard(newBoard);
    setReplayIndex(nextIdx);
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-8 px-6 bg-[#020617] text-slate-50 overflow-hidden select-none">
      <header className="text-center w-full space-y-1">
        <h1 className="text-3xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
          TIC·TAC·TOE
        </h1>
        <p className="text-[8px] uppercase tracking-[0.4em] text-slate-500 font-bold">Neural Core Engine v4.5</p>
      </header>

      <main className="w-full max-w-xs flex flex-col gap-6">
        <div className="space-y-4">
          {replayIndex === null ? (
            <>
              <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5">
                {[GameMode.PVE, GameMode.PVP].map(m => (
                  <button key={m} onClick={() => { setGameMode(m); resetGame(); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${gameMode === m ? 'bg-white text-black shadow-lg' : 'text-slate-500'}`}>
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
              <StatusBar isThinking={isThinking} winner={winner} isXNext={isXNext} />
            </>
          ) : (
            <div className="h-[92px] flex items-center justify-center">
               <span className="text-[10px] font-black text-cyan-500 tracking-[0.3em] uppercase animate-pulse">Analisando Jogadas</span>
            </div>
          )}
        </div>

        <Board 
          board={board} 
          onSquareClick={handleClick} 
          winningLine={replayIndex === null ? winningLine : null} 
          isGameOver={!!winner} 
          isThinking={isThinking} 
          isReplayMode={replayIndex !== null}
        />

        {replayIndex !== null ? (
          <ReplayControls 
            currentStep={replayIndex}
            totalSteps={lastMatchHistory?.length || 0}
            onNext={() => navigateReplay('next')}
            onPrev={() => navigateReplay('prev')}
            onExit={resetGame}
          />
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Jogador X', val: scores.X, color: 'text-cyan-400' },
              { label: 'Empates', val: scores.Draws, color: 'text-slate-500' },
              { label: 'IA O', val: scores.O, color: 'text-rose-400' }
            ].map(item => (
              <div key={item.label} className="bg-slate-900/40 py-3 rounded-2xl border border-white/5 backdrop-blur-md">
                <div className={`text-[7px] font-bold uppercase ${item.color} mb-1 opacity-80`}>{item.label}</div>
                <div className="text-xl font-black">{item.val}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="w-full max-w-xs flex flex-col gap-2">
        {winner && replayIndex === null && (
          <button 
            onClick={startReplay} 
            className="w-full py-3 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl mb-1 animate-in fade-in zoom-in-95 duration-500"
          >
            Replay da Partida
          </button>
        )}
        
        {replayIndex === null && (
          <button onClick={resetGame} className="w-full py-4 bg-white text-black font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl active:scale-95 transition-transform">
            {winner ? "Nova Partida" : "Reiniciar Jogo"}
          </button>
        )}
        
        {replayIndex === null && (
          <button onClick={() => { if(confirm("Zerar tudo?")) { setScores({X: 0, O: 0, Draws: 0}); localStorage.removeItem('ttt_scores_v4'); resetGame(); } }} className="w-full py-2 text-slate-600 hover:text-rose-400 font-bold text-[9px] uppercase tracking-widest transition-colors">
            Zerar Placar
          </button>
        )}
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1.05); filter: drop-shadow(0 0 20px rgba(16,185,129,0.5)); }
          50% { transform: scale(1.08); filter: brightness(1.2) drop-shadow(0 0 35px rgba(16,185,129,0.8)); }
        }
      `}</style>
    </div>
  );
};

export default App;
