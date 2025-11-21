// Game configuration constants

// Size of the game board (20x20 grid)
export const BOARD_SIZE = 20;

// Game speed in milliseconds (how fast the snake moves)
export const INITIAL_SPEED = 150;

// Direction mappings for keyboard controls
// Each direction has x,y deltas to move the snake
export const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }
};

// Initial snake position (center of board)
export const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 }
];

// Initial direction (moving right)
export const INITIAL_DIRECTION = DIRECTIONS.ArrowRight;
