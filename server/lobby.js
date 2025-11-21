const { v4: uuidv4 } = require('uuid');
const { WEAPONS } = require('./weapons');

/**
 * Lobby class to manage game rooms
 */
class Lobby {
  constructor(id = null, maxPlayers = 4) {
    this.id = id || uuidv4();
    this.maxPlayers = maxPlayers;
    this.players = new Map(); // Map of player ID -> Player object
    this.gameState = 'waiting'; // waiting, starting, playing, finished
    this.gameSettings = {
      boardSize: 20,
      gameSpeed: 150, // ms between moves
      weaponsEnabled: true,
      maxGameTime: 300000, // 5 minutes
      winCondition: 'last_standing' // last_standing, score_limit, time_limit
    };
    
    // Game data
    this.food = [];
    this.weapons = [];
    this.gameStartTime = null;
    this.gameLoop = null;
    
    // Lobby metadata
    this.createdAt = Date.now();
    this.createdBy = null;
    this.isPrivate = false;
    this.password = null;
    this.name = `Lobby ${Math.floor(Math.random() * 1000)}`;
  }
  
  /**
   * Add player to lobby
   */
  addPlayer(player) {
    if (this.players.size >= this.maxPlayers) {
      return { success: false, error: 'Lobby is full' };
    }
    
    if (this.gameState === 'playing') {
      return { success: false, error: 'Game in progress' };
    }
    
    this.players.set(player.id, player);
    player.lobbyId = this.id;
    player.resetForGame();
    
    // Set first player as lobby creator
    if (!this.createdBy) {
      this.createdBy = player.id;
    }
    
    this.broadcast({
      type: 'player_joined',
      player: player.getPublicInfo(),
      lobbyInfo: this.getLobbyInfo()
    });
    
    return { success: true };
  }
  
  /**
   * Remove player from lobby
   */
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    this.players.delete(playerId);
    player.lobbyId = null;
    
    // Transfer lobby ownership if creator left
    if (this.createdBy === playerId && this.players.size > 0) {
      const nextPlayer = this.players.values().next().value;
      this.createdBy = nextPlayer.id;
    }
    
    this.broadcast({
      type: 'player_left',
      playerId: playerId,
      lobbyInfo: this.getLobbyInfo()
    });
    
    // Stop game if not enough players
    if (this.gameState === 'playing' && this.getAlivePlayers().length <= 1) {
      this.endGame();
    }
    
    return true;
  }
  
  /**
   * Get player by ID
   */
  getPlayer(playerId) {
    return this.players.get(playerId);
  }
  
  /**
   * Get all alive players
   */
  getAlivePlayers() {
    return Array.from(this.players.values()).filter(p => p.isAlive);
  }
  
  /**
   * Get all ready players
   */
  getReadyPlayers() {
    return Array.from(this.players.values()).filter(p => p.isReady);
  }
  
  /**
   * Set player ready status
   */
  setPlayerReady(playerId, ready = true) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    player.isReady = ready;
    
    this.broadcast({
      type: 'player_ready_changed',
      playerId: playerId,
      isReady: ready,
      readyCount: this.getReadyPlayers().length,
      totalPlayers: this.players.size
    });
    
    // Auto-start if all players are ready
    if (this.canStartGame()) {
      setTimeout(() => this.startGame(), 2000); // 2 second delay
    }
    
    return true;
  }
  
  /**
   * Check if game can start
   */
  canStartGame() {
    return this.gameState === 'waiting' && 
           this.players.size >= 2 && 
           this.getReadyPlayers().length === this.players.size;
  }
  
  /**
   * Start the game
   */
  startGame() {
    if (!this.canStartGame()) return false;
    
    this.gameState = 'starting';
    this.gameStartTime = Date.now();
    
    // Initialize all players
    this.players.forEach(player => {
      player.initializeSnake(this.gameSettings.boardSize);
      player.gamesPlayed++;
    });
    
    // Generate initial food and weapons
    this.generateFood(5);
    if (this.gameSettings.weaponsEnabled) {
      this.generateWeapons(3);
    }
    
    // Broadcast game start
    this.broadcast({
      type: 'game_starting',
      countdown: 3
    });
    
    // Start countdown
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        this.broadcast({
          type: 'countdown',
          count: countdown
        });
      } else {
        clearInterval(countdownInterval);
        this.gameState = 'playing';
        this.startGameLoop();
        
        this.broadcast({
          type: 'game_started',
          gameState: this.getGameState()
        });
      }
    }, 1000);
    
    return true;
  }
  
  /**
   * Start the game loop
   */
  startGameLoop() {
    this.gameLoop = setInterval(() => {
      this.updateGame();
    }, this.gameSettings.gameSpeed);
  }
  
  /**
   * Update game state
   */
  updateGame() {
    if (this.gameState !== 'playing') return;
    
    // Move all alive players
    const alivePlayers = this.getAlivePlayers();
    alivePlayers.forEach(player => {
      player.moveSnake();
      this.checkCollisions(player);
    });
    
    // Check win condition
    if (this.checkWinCondition()) {
      this.endGame();
      return;
    }
    
    // Occasionally spawn new food/weapons
    if (Math.random() < 0.1) { // 10% chance
      this.generateFood(1);
    }
    
    if (this.gameSettings.weaponsEnabled && Math.random() < 0.05) { // 5% chance
      this.generateWeapons(1);
    }
    
    // Broadcast updated game state
    this.broadcast({
      type: 'game_update',
      gameState: this.getGameState()
    });
  }
  
  /**
   * Check collisions for a player
   */
  checkCollisions(player) {
    const head = player.snake[0];
    const { boardSize } = this.gameSettings;
    
    // Wall collision
    if (head.x < 0 || head.x >= boardSize || head.y < 0 || head.y >= boardSize) {
      player.kill();
      return;
    }
    
    // Self collision
    for (let i = 1; i < player.snake.length; i++) {
      if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
        player.kill();
        return;
      }
    }
    
    // Other players collision
    this.players.forEach(otherPlayer => {
      if (otherPlayer.id !== player.id && otherPlayer.isAlive) {
        for (let segment of otherPlayer.snake) {
          if (head.x === segment.x && head.y === segment.y) {
            player.kill(otherPlayer.id);
            otherPlayer.awardKill(player.id);
            return;
          }
        }
      }
    });
    
    // Food collision
    this.food = this.food.filter(food => {
      if (head.x === food.x && head.y === food.y) {
        player.growSnake();
        return false; // Remove this food
      }
      return true;
    });
    
    // Normal movement (remove tail if didn't eat food)
    const originalLength = player.snake.length;
    if (player.snake.length === originalLength) {
      player.removeTail();
    }
    
    // Weapon collision
    this.weapons = this.weapons.filter(weapon => {
      if (head.x === weapon.x && head.y === weapon.y) {
        player.weapon = weapon.type;
        player.send({
          type: 'weapon_acquired',
          weapon: weapon.type
        });
        return false; // Remove this weapon
      }
      return true;
    });
  }
  
  /**
   * Check win condition
   */
  checkWinCondition() {
    const alivePlayers = this.getAlivePlayers();
    
    // Last player standing
    if (alivePlayers.length <= 1) {
      return true;
    }
    
    // Time limit
    const gameTime = Date.now() - this.gameStartTime;
    if (gameTime >= this.gameSettings.maxGameTime) {
      return true;
    }
    
    return false;
  }
  
  /**
   * End the game
   */
  endGame() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    
    this.gameState = 'finished';
    const alivePlayers = this.getAlivePlayers();
    const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
    
    if (winner) {
      winner.gamesWon++;
    }
    
    // Calculate final rankings
    const rankings = this.calculateRankings();
    
    this.broadcast({
      type: 'game_ended',
      winner: winner ? winner.getPublicInfo() : null,
      rankings: rankings,
      gameStats: this.getGameStats()
    });
    
    // Reset lobby after delay
    setTimeout(() => {
      this.resetLobby();
    }, 10000); // 10 seconds to view results
  }
  
  /**
   * Calculate player rankings
   */
  calculateRankings() {
    return Array.from(this.players.values())
      .sort((a, b) => {
        // Sort by alive status, then score, then kills
        if (a.isAlive && !b.isAlive) return -1;
        if (!a.isAlive && b.isAlive) return 1;
        if (a.score !== b.score) return b.score - a.score;
        return b.kills - a.kills;
      })
      .map((player, index) => ({
        rank: index + 1,
        player: player.getPublicInfo(),
        finalScore: player.score
      }));
  }
  
  /**
   * Reset lobby for new game
   */
  resetLobby() {
    this.gameState = 'waiting';
    this.gameStartTime = null;
    this.food = [];
    this.weapons = [];
    
    this.players.forEach(player => {
      player.resetForGame();
    });
    
    this.broadcast({
      type: 'lobby_reset',
      lobbyInfo: this.getLobbyInfo()
    });
  }
  
  /**
   * Generate food on the board
   */
  generateFood(count) {
    for (let i = 0; i < count; i++) {
      let food;
      let attempts = 0;
      const maxAttempts = 100;
      
      do {
        food = {
          x: Math.floor(Math.random() * this.gameSettings.boardSize),
          y: Math.floor(Math.random() * this.gameSettings.boardSize),
          id: uuidv4(),
          type: 'normal',
          value: 10
        };
        attempts++;
      } while (this.isPositionOccupied(food.x, food.y) && attempts < maxAttempts);
      
      if (attempts < maxAttempts) {
        this.food.push(food);
      }
    }
  }
  
  /**
   * Generate weapons on the board
   */
  generateWeapons(count) {
    const weaponTypes = Object.keys(WEAPONS);
    
    for (let i = 0; i < count; i++) {
      let weapon;
      let attempts = 0;
      const maxAttempts = 100;
      
      do {
        weapon = {
          x: Math.floor(Math.random() * this.gameSettings.boardSize),
          y: Math.floor(Math.random() * this.gameSettings.boardSize),
          id: uuidv4(),
          type: weaponTypes[Math.floor(Math.random() * weaponTypes.length)]
        };
        attempts++;
      } while (this.isPositionOccupied(weapon.x, weapon.y) && attempts < maxAttempts);
      
      if (attempts < maxAttempts) {
        this.weapons.push(weapon);
      }
    }
  }
  
  /**
   * Check if position is occupied
   */
  isPositionOccupied(x, y) {
    // Check snake positions
    for (let player of this.players.values()) {
      if (player.isAlive) {
        for (let segment of player.snake) {
          if (segment.x === x && segment.y === y) {
            return true;
          }
        }
      }
    }
    
    // Check food positions
    for (let food of this.food) {
      if (food.x === x && food.y === y) {
        return true;
      }
    }
    
    // Check weapon positions
    for (let weapon of this.weapons) {
      if (weapon.x === x && weapon.y === y) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Handle player input
   */
  handlePlayerInput(playerId, input) {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive || this.gameState !== 'playing') return;
    
    if (input.type === 'direction' && input.direction) {
      player.updateDirection(input.direction);
    }
    
    // Handle weapon usage
    if (input.type === 'use_weapon' && player.weapon) {
      this.handleWeaponUse(player);
    }
  }
  
  /**
   * Handle weapon usage
   */
  handleWeaponUse(player) {
    const weapon = WEAPONS[player.weapon];
    if (!weapon) return;
    
    // Implement weapon effects based on type
    switch (weapon.type) {
      case 'speed_boost':
        // Temporary speed increase
        break;
      case 'shield':
        // Temporary invincibility
        break;
      case 'laser':
        // Shoot laser in current direction
        break;
      default:
        console.warn(`Unknown weapon type: ${weapon.type}`);
        break;
    }
    
    // Use up weapon
    player.weapon = null;
  }
  
  /**
   * Broadcast message to all players
   */
  broadcast(message, excludePlayer = null) {
    this.players.forEach(player => {
      if (excludePlayer && player.id === excludePlayer.id) return;
      player.send(message);
    });
  }
  
  /**
   * Get current game state
   */
  getGameState() {
    return {
      players: Array.from(this.players.values()).map(p => ({
        ...p.getPublicInfo(),
        snake: p.snake,
        direction: p.direction
      })),
      food: this.food,
      weapons: this.weapons,
      gameTime: this.gameStartTime ? Date.now() - this.gameStartTime : 0,
      boardSize: this.gameSettings.boardSize
    };
  }
  
  /**
   * Get lobby information
   */
  getLobbyInfo() {
    return {
      id: this.id,
      name: this.name,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      gameState: this.gameState,
      isPrivate: this.isPrivate,
      createdBy: this.createdBy,
      gameSettings: this.gameSettings,
      players: Array.from(this.players.values()).map(p => p.getPublicInfo())
    };
  }
  
  /**
   * Get game statistics
   */
  getGameStats() {
    const gameTime = this.gameStartTime ? Date.now() - this.gameStartTime : 0;
    
    return {
      duration: gameTime,
      totalPlayers: this.players.size,
      foodConsumed: 0, // Could track this
      totalKills: Array.from(this.players.values()).reduce((sum, p) => sum + p.kills, 0)
    };
  }
  
  /**
   * Check if lobby is empty
   */
  isEmpty() {
    return this.players.size === 0;
  }
  
  /**
   * Update lobby settings (only by creator)
   */
  updateSettings(playerId, newSettings) {
    if (playerId !== this.createdBy || this.gameState !== 'waiting') {
      return false;
    }
    
    this.gameSettings = { ...this.gameSettings, ...newSettings };
    
    this.broadcast({
      type: 'lobby_settings_updated',
      settings: this.gameSettings
    });
    
    return true;
  }
}

module.exports = Lobby;