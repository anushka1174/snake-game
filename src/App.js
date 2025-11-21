import React, { useState, useEffect } from 'react';
import GameBoard from "./components/GameBoard";
import useGameLoop from "./hooks/useGameLoop";
import { INITIAL_SNAKE, INITIAL_DIRECTION, DIRECTIONS } from "./game/constants";
import { connect, sendMessage, onMessage, onConnect, onDisconnect, onError, getConnectionStatus } from "./services/websocket";

function App() {
  // Game state
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 15, y: 15 });
  
  // WebSocket connection state
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0
  });
  const [serverMessages, setServerMessages] = useState([]);

  // Use the game loop hook
  useGameLoop({
    snake,
    setSnake,
    direction,
    setDirection,
    food,
    setFood
  });

  // WebSocket initialization and event handlers
  useEffect(() => {
    let messageUnsubscribe, connectUnsubscribe, disconnectUnsubscribe, errorUnsubscribe;

    const initializeWebSocket = async () => {
      try {
        // Set up event handlers before connecting
        messageUnsubscribe = onMessage((message) => {
          console.log('Received server message:', message);
          setServerMessages(prev => [...prev.slice(-9), message]); // Keep last 10 messages
        });

        connectUnsubscribe = onConnect(() => {
          console.log('Connected to server!');
          setConnectionStatus(getConnectionStatus());
          
          // Send initial connection message
          setTimeout(() => {
            sendMessage('connect_player', { name: 'Anushka' });
          }, 100);
        });

        disconnectUnsubscribe = onDisconnect(() => {
          console.log('Disconnected from server');
          setConnectionStatus(getConnectionStatus());
        });

        errorUnsubscribe = onError((error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus(getConnectionStatus());
        });

        // Connect to the server
        await connect();
        
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        setConnectionStatus(getConnectionStatus());
      }
    };

    initializeWebSocket();

    // Update connection status periodically
    const statusInterval = setInterval(() => {
      setConnectionStatus(getConnectionStatus());
    }, 1000);

    // Cleanup function
    return () => {
      if (messageUnsubscribe) messageUnsubscribe();
      if (connectUnsubscribe) connectUnsubscribe();
      if (disconnectUnsubscribe) disconnectUnsubscribe();
      if (errorUnsubscribe) errorUnsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

  // Handle keyboard input for direction changes
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (DIRECTIONS[event.key]) {
        const newDirection = DIRECTIONS[event.key];
        
        // Prevent reverse direction (can't go directly backwards)
        setDirection(currentDirection => {
          const isReverse = 
            (currentDirection.x === -newDirection.x && currentDirection.y === -newDirection.y);
          
          return isReverse ? currentDirection : newDirection;
        });
        
        // Send direction to server if connected
        if (connectionStatus.isConnected) {
          sendMessage('player_input', {
            type: 'direction',
            direction: newDirection
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [connectionStatus.isConnected]);

  // Connection status indicator
  const getConnectionStatusText = () => {
    if (connectionStatus.isConnected) {
      return "🟢 Connected to Server";
    } else if (connectionStatus.isReconnecting) {
      return `🟡 Reconnecting... (${connectionStatus.reconnectAttempts})`;
    } else {
      return "🔴 Disconnected";
    }
  };

  return (
    <div className="App">
      <h1>Multiplayer Snake Game</h1>
      <div style={{ 
        padding: '10px', 
        margin: '10px 0', 
        backgroundColor: connectionStatus.isConnected ? '#d4edda' : '#f8d7da',
        border: `1px solid ${connectionStatus.isConnected ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '5px',
        color: connectionStatus.isConnected ? '#155724' : '#721c24'
      }}>
        <strong>Status:</strong> {getConnectionStatusText()}
      </div>
      
      <p>Use arrow keys to control the snake</p>
      <p>Score: {snake.length - 3}</p>
      
      <GameBoard snake={snake} food={food} />
      
      {/* Debug: Recent server messages */}
      {serverMessages.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6',
          borderRadius: '5px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <h4>Recent Server Messages:</h4>
          {serverMessages.slice(-5).map((msg, index) => (
            <div key={index} style={{ fontSize: '12px', marginBottom: '5px', fontFamily: 'monospace' }}>
              <strong>{msg.type}:</strong> {JSON.stringify(msg, null, 2)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
