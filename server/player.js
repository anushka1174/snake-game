const { v4: uuidv4 } = require('uuid');

/**
 * Player class to represent a connected player
 */
class Player {
  constructor(ws, id = null) {
    this.id = id || uuidv4();
    this.ws = ws;
    this.name = `Player${Math.floor(Math.random() * 1000)}`;
    this.lobbyId = null;
    this.isReady = false;
    this.isAlive = true;
    this.score = 0;
    
    // Snake game specific properties
    this.snake = [];
    this.direction = { x: 1, y: 0 }; // Moving right by default
    this.color = this.generateRandomColor();
    this.weapon = null; // Current weapon equipped
    
    // Player stats
    this.kills = 0;
    this.deaths = 0;
    this.gamesPlayed = 0;
    this.gamesWon = 0;
    
    // Connection info
    this.lastActivity = Date.now();
    this.connectionTime = Date.now();
  }
  
  /**
   * Generate a random color for the player's snake
   */
  generateRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
      '#00D2D3', '#FF9F43', '#55A3FF', '#FD79A8'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Send message to this player
   */
  send(message) {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.lastActivity = Date.now();
        return true;
      } catch (error) {
        console.error(`Error sending message to player ${this.id}:`, error);
        return false;
      }
    }
    return false;
  }
  
  /**
   * Initialize player's snake at a random position
   */
  initializeSnake(boardSize = 20) {
    const startX = Math.floor(Math.random() * (boardSize - 6)) + 3;
    const startY = Math.floor(Math.random() * (boardSize - 6)) + 3;
    
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    
    this.isAlive = true;
    this.direction = { x: 1, y: 0 };
  }
  
  /**
   * Update player's direction (with validation)
   */
  updateDirection(newDirection) {
    // Prevent reversing direction
    const opposite = {
      x: -this.direction.x,
      y: -this.direction.y
    };
    
    if (newDirection.x !== opposite.x || newDirection.y !== opposite.y) {
      this.direction = newDirection;
      return true;
    }
    return false;
  }
  
  /**
   * Move snake in current direction
   */
  moveSnake() {
    if (!this.isAlive || this.snake.length === 0) return false;
    
    const head = this.snake[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y
    };
    
    this.snake.unshift(newHead);
    return true;
  }
  
  /**
   * Grow snake (don't remove tail)
   */
  growSnake() {
    // Snake already grew when we added the new head
    this.score += 10;
  }
  
  /**
   * Remove tail (normal movement)
   */
  removeTail() {
    this.snake.pop();
  }
  
  /**
   * Kill this player
   */
  kill(killerId = null) {
    this.isAlive = false;
    this.deaths++;
    
    if (killerId) {
      // Award points to killer
      this.send({
        type: 'killed',
        by: killerId,
        message: `You were killed by ${killerId}`
      });
    } else {
      this.send({
        type: 'killed',
        message: 'You died'
      });
    }
  }
  
  /**
   * Award kill to player
   */
  awardKill(victimId) {
    this.kills++;
    this.score += 50;
    
    this.send({
      type: 'kill_awarded',
      victim: victimId,
      totalKills: this.kills,
      newScore: this.score
    });
  }
  
  /**
   * Reset player for new game
   */
  resetForGame() {
    this.snake = [];
    this.isAlive = true;
    this.isReady = false;
    this.weapon = null;
    this.direction = { x: 1, y: 0 };
  }
  
  /**
   * Get player info for sharing
   */
  getPublicInfo() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      score: this.score,
      kills: this.kills,
      deaths: this.deaths,
      isReady: this.isReady,
      isAlive: this.isAlive,
      weapon: this.weapon
    };
  }
  
  /**
   * Get detailed player stats
   */
  getStats() {
    const connectionDuration = Date.now() - this.connectionTime;
    const winRate = this.gamesPlayed > 0 ? (this.gamesWon / this.gamesPlayed * 100).toFixed(1) : 0;
    
    return {
      ...this.getPublicInfo(),
      gamesPlayed: this.gamesPlayed,
      gamesWon: this.gamesWon,
      winRate: `${winRate}%`,
      connectionDuration: Math.floor(connectionDuration / 1000), // in seconds
      lastActivity: this.lastActivity
    };
  }
  
  /**
   * Check if player is inactive
   */
  isInactive(timeoutMs = 300000) { // 5 minutes default
    return Date.now() - this.lastActivity > timeoutMs;
  }
}

module.exports = Player;