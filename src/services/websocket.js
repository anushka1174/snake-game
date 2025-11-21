/**
 * WebSocket client for multiplayer snake game
 * Handles connection, auto-reconnect, and message passing
 */

class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    
    // Event handlers
    this.messageHandlers = [];
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.errorHandlers = [];
    
    // Auto-reconnect timer
    this.reconnectTimer = null;
  }
  
  /**
   * Connect to the WebSocket server
   */
  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to WebSocket: ${this.url}`);
        this.socket = new WebSocket(this.url);
        
        this.socket.onopen = (event) => {
          console.log('WebSocket connected successfully');
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000; // Reset delay
          
          // Clear reconnect timer
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          
          // Notify connect handlers
          this.connectHandlers.forEach(handler => {
            try {
              handler(event);
            } catch (error) {
              console.error('Error in connect handler:', error);
            }
          });
          
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            
            // Notify all message handlers
            this.messageHandlers.forEach(handler => {
              try {
                handler(data);
              } catch (error) {
                console.error('Error in message handler:', error);
              }
            });
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        this.socket.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          
          // Notify disconnect handlers
          this.disconnectHandlers.forEach(handler => {
            try {
              handler(event);
            } catch (error) {
              console.error('Error in disconnect handler:', error);
            }
          });
          
          // Attempt to reconnect if not manually closed
          if (event.code !== 1000 && !this.isReconnecting) {
            this.attemptReconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          // Notify error handlers
          this.errorHandlers.forEach(handler => {
            try {
              handler(error);
            } catch (handlerError) {
              console.error('Error in error handler:', handlerError);
            }
          });
          
          reject(error);
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.isReconnecting = false;
        this.attemptReconnect();
      });
    }, this.reconnectDelay);
  }
  
  /**
   * Send a message to the server
   */
  sendMessage(type, payload = {}) {
    if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected. Message not sent:', { type, payload });
      return false;
    }
    
    try {
      const message = {
        type: type,
        data: payload,
        timestamp: Date.now()
      };
      
      console.log('Sending WebSocket message:', message);
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }
  
  /**
   * Add message handler
   */
  onMessage(handler) {
    if (typeof handler === 'function') {
      this.messageHandlers.push(handler);
      
      // Return unsubscribe function
      return () => {
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1) {
          this.messageHandlers.splice(index, 1);
        }
      };
    }
  }
  
  /**
   * Add connect handler
   */
  onConnect(handler) {
    if (typeof handler === 'function') {
      this.connectHandlers.push(handler);
      
      return () => {
        const index = this.connectHandlers.indexOf(handler);
        if (index > -1) {
          this.connectHandlers.splice(index, 1);
        }
      };
    }
  }
  
  /**
   * Add disconnect handler
   */
  onDisconnect(handler) {
    if (typeof handler === 'function') {
      this.disconnectHandlers.push(handler);
      
      return () => {
        const index = this.disconnectHandlers.indexOf(handler);
        if (index > -1) {
          this.disconnectHandlers.splice(index, 1);
        }
      };
    }
  }
  
  /**
   * Add error handler
   */
  onError(handler) {
    if (typeof handler === 'function') {
      this.errorHandlers.push(handler);
      
      return () => {
        const index = this.errorHandlers.indexOf(handler);
        if (index > -1) {
          this.errorHandlers.splice(index, 1);
        }
      };
    }
  }
  
  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.isReconnecting = false;
    
    if (this.socket) {
      console.log('Disconnecting WebSocket');
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
    
    this.isConnected = false;
  }
  
  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.socket ? this.socket.readyState : WebSocket.CLOSED
    };
  }
  
  /**
   * Check if connected
   */
  isConnectionOpen() {
    return this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

// Create a singleton instance
const wsClient = new WebSocketClient('ws://localhost:3001');

// Export the singleton instance and utility functions
export default wsClient;

export const connect = () => wsClient.connect();
export const sendMessage = (type, payload) => wsClient.sendMessage(type, payload);
export const onMessage = (callback) => wsClient.onMessage(callback);
export const onConnect = (callback) => wsClient.onConnect(callback);
export const onDisconnect = (callback) => wsClient.onDisconnect(callback);
export const onError = (callback) => wsClient.onError(callback);
export const disconnect = () => wsClient.disconnect();
export const getConnectionStatus = () => wsClient.getConnectionStatus();
export const isConnected = () => wsClient.isConnectionOpen();