
export type Player = 'X' | 'O';
export type SquareValue = Player | null;

export enum GameMode {
  PVP = 'PVP',
  PVE = 'PVE'
}

export interface GameState {
  board: SquareValue[];
  isXNext: boolean;
  winner: Player | 'Draw' | null;
  winningLine: number[] | null;
}
