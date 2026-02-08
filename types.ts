
export type Player = 'X' | 'O';
export type SquareValue = Player | null;

export enum GameMode {
  PVP = 'PVP',
  PVE = 'PVE'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  NEURAL = 'NEURAL'
}

export interface Scores {
  X: number;
  O: number;
  Draws: number;
}

export interface GameMove {
  index: number;
  player: Player;
}
