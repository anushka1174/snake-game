const Player = require('./player');
const Lobby = require('./lobby');

/**
 * GameManager class to handle all lobbies and players
 */
class GameManager {
  constructor() {
    this.players = new Map(); // WebSocket -> Player
    this.lobbies = new Map(); // lobbyId -> Lobby
    this.playerToLobby = new Map(); // playerId -> lobbyId
    
    // Cleanup intervals
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactivePlayers();
      this.cleanupEmptyLobbies();
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Add a new player connection
   */
  addPlayer(ws) {
    const player = new Player(ws);
    this.players.set(ws, player);
    
    console.log(`Player ${player.id} (${player.name}) connected`);
    
    // Send player their info and available lobbies
    player.send({
      type: 'player_info',
      player: player.getPublicInfo(),
      lobbies: this.getPublicLobbies()
    });
    
    return player;
  }
  
  /**
   * Remove a player
   */
  removePlayer(ws) {
    const player = this.players.get(ws);
    if (!player) return false;
    
    console.log(`Player ${player.id} (${player.name}) disconnected`);
    
    // Remove from lobby if in one
    if (player.lobbyId) {
      const lobby = this.lobbies.get(player.lobbyId);
      if (lobby) {
        lobby.removePlayer(player.id);
      }
    }
    
    this.players.delete(ws);
    this.playerToLobby.delete(player.id);
    
    return true;
  }
  
  /**
   * Handle incoming messages from players
   */
  handleMessage(ws, message) {
    const player = this.players.get(ws);
    if (!player) {
      console.error('Message from unknown player');
      return;
    }
    
    console.log(`Message from ${player.name}:`, message.type);
    
    switch (message.type) {
      case 'connect_player':
        this.handleConnectPlayer(player, message.data);
        break;
        
      case 'create_lobby':
        this.handleCreateLobby(player, message.data);
        break;
        
      case 'join_lobby':
        this.handleJoinLobby(player, message.data);
        break;
        
      case 'leave_lobby':
        this.handleLeaveLobby(player);
        break;
        
      case 'set_ready':
        this.handleSetReady(player, message.data);
        break;
        
      case 'player_input':
        this.handlePlayerInput(player, message.data);
        break;
        
      case 'chat_message':
        this.handleChatMessage(player, message.data);
        break;
        
      case 'update_player_name':
        this.handleUpdatePlayerName(player, message.data);
        break;
        
      case 'get_lobbies':
        this.handleGetLobbies(player);
        break;
        
      case 'get_player_stats':
        this.handleGetPlayerStats(player);
        break;
        
      case 'update_lobby_settings':
        this.handleUpdateLobbySettings(player, message.data);
        break;
        
      default:
        console.warn(`Unknown message type: ${message.type}`);
        player.send({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        });
    }
  }
  
  /**
   * Handle player connection and name setup
   */
  handleConnectPlayer(player, data = {}) {
    if (data.name && data.name.length > 0 && data.name.length <= 20) {
      player.name = data.name;
    }
    
    console.log(`Player ${player.id} set name to: ${player.name}`);
    
    player.send({
      type: 'connection_confirmed',
      player: player.getPublicInfo(),
      serverInfo: {
        playerCount: this.getPlayerCount(),
        lobbyCount: this.getLobbyCount()
      }
    });
  }
  
  /**
   * Handle lobby creation
   */
  handleCreateLobby(player, data = {}) {
    if (player.lobbyId) {
      player.send({
        type: 'error',
        message: 'You are already in a lobby'
      });
      return;
    }
    
    const lobby = new Lobby(null, data.maxPlayers || 4);
    lobby.name = data.name || `${player.name}'s Lobby`;
    lobby.isPrivate = data.isPrivate || false;
    lobby.password = data.password || null;
    
    // Set custom game settings if provided
    if (data.gameSettings) {
      lobby.gameSettings = { ...lobby.gameSettings, ...data.gameSettings };
    }
    
    this.lobbies.set(lobby.id, lobby);
    
    const result = lobby.addPlayer(player);
    if (result.success) {
      this.playerToLobby.set(player.id, lobby.id);
      
      player.send({
        type: 'lobby_created',
        lobby: lobby.getLobbyInfo()
      });
      
      console.log(`Lobby ${lobby.id} created by ${player.name}`);
    } else {
      player.send({
        type: 'error',
        message: result.error
      });
    }
  }
  
  /**
   * Handle lobby join
   */
  handleJoinLobby(player, data) {
    if (player.lobbyId) {
      player.send({
        type: 'error',
        message: 'You are already in a lobby'
      });
      return;
    }
    
    const lobby = this.lobbies.get(data.lobbyId);
    if (!lobby) {
      player.send({
        type: 'error',
        message: 'Lobby not found'
      });
      return;
    }
    
    // Check password if lobby is private
    if (lobby.isPrivate && lobby.password !== data.password) {
      player.send({
        type: 'error',
        message: 'Invalid password'
      });
      return;
    }
    
    const result = lobby.addPlayer(player);
    if (result.success) {
      this.playerToLobby.set(player.id, lobby.id);
      
      player.send({
        type: 'lobby_joined',
        lobby: lobby.getLobbyInfo()
      });
      
      console.log(`Player ${player.name} joined lobby ${lobby.id}`);
    } else {
      player.send({
        type: 'error',
        message: result.error
      });
    }
  }
  
  /**
   * Handle lobby leave
   */
  handleLeaveLobby(player) {
    if (!player.lobbyId) {
      player.send({
        type: 'error',
        message: 'You are not in a lobby'
      });
      return;
    }
    
    const lobby = this.lobbies.get(player.lobbyId);
    if (lobby) {
      lobby.removePlayer(player.id);
      this.playerToLobby.delete(player.id);
      
      player.send({
        type: 'lobby_left'
      });
      
      console.log(`Player ${player.name} left lobby ${lobby.id}`);
    }
  }
  
  /**
   * Handle ready status change
   */
  handleSetReady(player, data) {
    if (!player.lobbyId) {
      player.send({
        type: 'error',
        message: 'You are not in a lobby'
      });
      return;
    }
    
    const lobby = this.lobbies.get(player.lobbyId);
    if (lobby) {
      lobby.setPlayerReady(player.id, data.ready);
    }
  }
  
  /**
   * Handle player input during game
   */
  handlePlayerInput(player, data) {
    if (!player.lobbyId) return;
    
    const lobby = this.lobbies.get(player.lobbyId);
    if (lobby) {
      lobby.handlePlayerInput(player.id, data);
    }
  }
  
  /**
   * Handle chat messages
   */
  handleChatMessage(player, data) {
    if (!player.lobbyId || !data.message) return;
    
    const lobby = this.lobbies.get(player.lobbyId);
    if (lobby) {
      lobby.broadcast({
        type: 'chat_message',
        from: player.getPublicInfo(),
        message: data.message,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle player name update
   */
  handleUpdatePlayerName(player, data) {
    if (!data.name || data.name.length < 1 || data.name.length > 20) {
      player.send({
        type: 'error',
        message: 'Name must be 1-20 characters'
      });
      return;
    }
    
    const oldName = player.name;
    player.name = data.name;
    
    player.send({
      type: 'name_updated',
      oldName: oldName,
      newName: player.name
    });
    
    // Notify lobby if player is in one
    if (player.lobbyId) {
      const lobby = this.lobbies.get(player.lobbyId);
      if (lobby) {
        lobby.broadcast({
          type: 'player_name_changed',
          playerId: player.id,
          oldName: oldName,
          newName: player.name
        }, player);
      }
    }
  }
  
  /**
   * Handle get lobbies request
   */
  handleGetLobbies(player) {
    player.send({
      type: 'lobbies_list',
      lobbies: this.getPublicLobbies()
    });
  }
  
  /**
   * Handle get player stats request
   */
  handleGetPlayerStats(player) {
    player.send({
      type: 'player_stats',
      stats: player.getStats(),
      serverStats: this.getServerStats()
    });
  }
  
  /**
   * Handle lobby settings update
   */
  handleUpdateLobbySettings(player, data) {
    if (!player.lobbyId) {
      player.send({
        type: 'error',
        message: 'You are not in a lobby'
      });
      return;
    }
    
    const lobby = this.lobbies.get(player.lobbyId);
    if (lobby) {
      const success = lobby.updateSettings(player.id, data.settings);
      if (!success) {
        player.send({
          type: 'error',
          message: 'You cannot modify lobby settings'
        });
      }
    }
  }
  
  /**
   * Get public lobby information
   */
  getPublicLobbies() {
    return Array.from(this.lobbies.values())
      .filter(lobby => !lobby.isPrivate && lobby.gameState === 'waiting')
      .map(lobby => ({
        id: lobby.id,
        name: lobby.name,
        playerCount: lobby.players.size,
        maxPlayers: lobby.maxPlayers,
        gameState: lobby.gameState,
        gameSettings: lobby.gameSettings
      }));
  }
  
  /**
   * Get server statistics
   */
  getServerStats() {
    const totalPlayers = this.players.size;
    const totalLobbies = this.lobbies.size;
    const activeGames = Array.from(this.lobbies.values())
      .filter(lobby => lobby.gameState === 'playing').length;
    
    return {
      totalPlayers,
      totalLobbies,
      activeGames,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
  
  /**
   * Get player count
   */
  getPlayerCount() {
    return this.players.size;
  }
  
  /**
   * Get lobby count
   */
  getLobbyCount() {
    return this.lobbies.size;
  }
  
  /**
   * Clean up inactive players
   */
  cleanupInactivePlayers() {
    const now = Date.now();
    const timeout = 300000; // 5 minutes
    
    this.players.forEach((player, ws) => {
      if (now - player.lastActivity > timeout) {
        console.log(`Removing inactive player: ${player.name}`);
        this.removePlayer(ws);
        
        // Close the WebSocket connection
        if (ws.readyState === ws.OPEN) {
          ws.close(1000, 'Inactive');
        }
      }
    });
  }
  
  /**
   * Clean up empty lobbies
   */
  cleanupEmptyLobbies() {
    const emptyLobbies = [];
    
    this.lobbies.forEach((lobby, lobbyId) => {
      if (lobby.isEmpty()) {
        emptyLobbies.push(lobbyId);
      }
    });
    
    emptyLobbies.forEach(lobbyId => {
      console.log(`Removing empty lobby: ${lobbyId}`);
      this.lobbies.delete(lobbyId);
    });
  }
  
  /**
   * Broadcast message to all connected players
   */
  broadcastToAll(message) {
    this.players.forEach(player => {
      player.send(message);
    });
  }
  
  /**
   * Shutdown cleanup
   */
  shutdown() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Stop all games
    this.lobbies.forEach(lobby => {
      if (lobby.gameLoop) {
        clearInterval(lobby.gameLoop);
      }
    });
    
    // Notify all players
    this.broadcastToAll({
      type: 'server_shutdown',
      message: 'Server is shutting down'
    });
    
    console.log('GameManager shutdown complete');
  }
}

module.exports = GameManager;