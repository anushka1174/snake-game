const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const GameManager = require('./gameManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize game manager
const gameManager = new GameManager();

// Middleware
app.use(express.json());
app.use(express.static('public')); // Serve static files if needed

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Snake Game Server Running',
    players: gameManager.getPlayerCount(),
    lobbies: gameManager.getLobbyCount()
  });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  // Handle player connection
  gameManager.addPlayer(ws);
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      gameManager.handleMessage(ws, message);
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    gameManager.removePlayer(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    gameManager.removePlayer(ws);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Snake Game Server'
  }));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🐍 Snake Game Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, wss };