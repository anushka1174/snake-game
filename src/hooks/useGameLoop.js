import { useEffect, useRef, useCallback } from 'react';
import { BOARD_SIZE } from '../game/constants';

// Custom hook to manage the snake game loop
export default function useGameLoop({
  snake,
  setSnake,
  direction,
  setDirection,
  food,
  setFood
}) {
  const gameLoopRef = useRef(null);
  const directionRef = useRef(direction);

  // Keep direction ref updated
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // Generate random food position that doesn't collide with snake
  const generateFood = useCallback((currentSnake) => {
    const isPositionOccupied = (pos, snakeSegments) => {
      return snakeSegments.some(segment => segment.x === pos.x && segment.y === pos.y);
    };
    
    let newFood;
    let attempts = 0;
    const maxAttempts = BOARD_SIZE * BOARD_SIZE;
    
    do {
      newFood = {
        x: Math.floor(Math.random() * BOARD_SIZE),
        y: Math.floor(Math.random() * BOARD_SIZE)
      };
      attempts++;
    } while (isPositionOccupied(newFood, currentSnake) && attempts < maxAttempts);
    
    return newFood;
  }, []);

  // Check if position is out of bounds
  const isOutOfBounds = useCallback((x, y) => {
    return x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE;
  }, []);

  // Check if snake collides with itself
  const checkSelfCollision = useCallback((head, body) => {
    return body.some(segment => segment.x === head.x && segment.y === head.y);
  }, []);

  // Main game tick function
  const gameTick = useCallback(() => {
    setSnake(currentSnake => {
      if (!currentSnake || currentSnake.length === 0) return currentSnake;

      const head = currentSnake[0];
      const currentDirection = directionRef.current;
      
      // Calculate new head position
      const newHead = {
        x: head.x + currentDirection.x,
        y: head.y + currentDirection.y
      };

      // Check wall collision
      if (isOutOfBounds(newHead.x, newHead.y)) {
        // Game over - reset to initial state
        console.log('Game Over: Wall collision');
        return currentSnake; // Keep current state for now
      }

      // Check self collision
      if (checkSelfCollision(newHead, currentSnake)) {
        // Game over - reset to initial state
        console.log('Game Over: Self collision');
        return currentSnake; // Keep current state for now
      }

      // Create new snake with new head
      const newSnake = [newHead, ...currentSnake];

      // Check food collision
      if (food && newHead.x === food.x && newHead.y === food.y) {
        // Snake ate food - don't remove tail (snake grows)
        setFood(generateFood(newSnake));
        return newSnake;
      } else {
        // Normal movement - remove tail
        newSnake.pop();
        return newSnake;
      }
    });
  }, [food, setFood, setSnake, generateFood, isOutOfBounds, checkSelfCollision]);

  // Set up game loop
  useEffect(() => {
    const startGameLoop = () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      
      gameLoopRef.current = setInterval(gameTick, 150);
    };

    startGameLoop();

    // Cleanup function
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameTick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, []);
}
