import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Chat from './components/Chat';

import { translations } from './translations';

// Auto-switch between Localhost and Production Server
const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://jimmyhummluk-uno-online.hf.space';

const socket = io(SERVER_URL);

function App() {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [winner, setWinner] = useState(null);
  const [language, setLanguage] = useState('tr'); // Default Turkish
  const [myPlayerId, setMyPlayerId] = useState(() => {
    const stored = localStorage.getItem('uno_player_id');
    if (stored) return stored;
    const newId = 'player_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem('uno_player_id', newId);
    return newId;
  });
  const [serverError, setServerError] = useState('');

  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const t = translations[language];

  // Track if we've already attempted an auto-rejoin for this connection
  const hasAttemptedRejoin = React.useRef(false);

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      setServerError('');
      hasAttemptedRejoin.current = false; // Reset on new connection
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('gameState', (state) => {
      // Auto-rejoin ONLY if:
      // 1. We have a player ID
      // 2. We haven't tried rejoining on THIS socket connection yet
      // 3. The server shows us as disconnected
      if (myPlayerId && !hasAttemptedRejoin.current && state?.players) {
        const existingPlayer = state.players.find(p => p.id === myPlayerId);

        // If we are in the list but marked as disconnected, try to rejoin ONCE after a small delay
        if (existingPlayer && !existingPlayer.connected) {
          console.log('Detected disconnected state. Scheduled auto-rejoin in 1s...');
          hasAttemptedRejoin.current = true; // Mark as attempted immediately to prevent double-schedule
          setTimeout(() => {
            socket.emit('joinGame', {
              username: localStorage.getItem('uno_player_name') || existingPlayer.name || 'Player',
              playerId: myPlayerId
            });
          }, 1000); // 1s delay to let server settle
        } else if (existingPlayer && existingPlayer.connected && existingPlayer.socketId !== socket.id) {
          // IMPORTANT: If we are "connected" but with a DIFFERENT socket ID, 
          // it means another tab/window is using our ID. 
          // DO NOT try to auto-hijack it here, as it causes an infinite loop between tabs.
          console.warn('Session is active in another tab. Auto-rejoin disabled to prevent loop.');
          hasAttemptedRejoin.current = true; // Stop trying
        }
      }

      setGameState(state);
    });

    socket.on('gameOver', ({ winner }) => {
      setWinner(winner);
    });

    socket.on('error', (msg) => {
      setServerError(msg);
      // Clear error after 3 seconds
      setTimeout(() => setServerError(''), 5000);
    });

    socket.on('chatMessage', (msg) => {
      setChatMessages(prev => [...prev, msg]);
      if (!chatOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameState');
      socket.off('gameOver');
      socket.off('error');
    };
  }, [myPlayerId]);

  // Derived state for view switching
  const isInLobby = gameState && (gameState.status === 'waiting' || gameState.status === 'finished');
  const isPlaying = gameState && gameState.status === 'playing';

  if (!gameState) {
    return (
      <div className="loading-container">
        <div className="loading-card-stack">
          <div className="loading-card red">UNO</div>
          <div className="loading-card blue">UNO</div>
          <div className="loading-card green">UNO</div>
        </div>
        <h2 className="loading-title">{t.loading}...</h2>
        <div className="loading-status">
          <span style={{
            height: '10px',
            width: '10px',
            borderRadius: '50%',
            background: isConnected ? '#4caf50' : '#f44336',
            boxShadow: `0 0 10px ${isConnected ? '#4caf50' : '#f44336'}`
          }}></span>
          {isConnected ? 'Server Connected' : 'Connecting to Server...'}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Error Toast */}
      {serverError && (
        <div style={{
          position: 'absolute',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'red',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          zIndex: 9999,
          fontWeight: 'bold',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
        }}>
          {serverError}
        </div>
      )}

      {/* Language Toggle - Only Show in Lobby */}
      {isInLobby && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 3000 }}>
          <button
            onClick={() => setLanguage(l => l === 'tr' ? 'en' : 'tr')}
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              border: '1px solid white',
              padding: '5px 10px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {language === 'tr' ? '🇹🇷 TR / 🇬🇧 EN' : '🇬🇧 EN / 🇹🇷 TR'}
          </button>
        </div>
      )}

      {/* Chat Feature - Only Show In Game */}
      {isPlaying && (
        <>
          {/* Chat Toggle Button */}
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 3000 }}>
            <button
              onClick={() => {
                setChatOpen(!chatOpen);
                if (!chatOpen) setUnreadCount(0);
              }}
              style={{
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                width: '45px',
                height: '45px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                position: 'relative'
              }}
            >
              💬
              {unreadCount > 0 && !chatOpen && (
                <span className="unread-badge">{unreadCount}</span>
              )}
            </button>
          </div>

          <Chat
            socket={socket}
            myPlayerId={myPlayerId}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            messages={chatMessages}
            t={t}
          />
        </>
      )}

      {winner && (
        <div className="color-picker-overlay">
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <h1>{t.gameOver}</h1>
            <h2>{t.won}: {gameState.players.find(p => p.id === winner)?.name || 'Unknown'}</h2>
            <button className="btn-primary" onClick={() => {
              socket.emit('returnToLobby', { isGameOver: true });
              setWinner(null);
            }}>{t.returnToLobby}</button>
          </div>
        </div>
      )}

      {isInLobby && (
        <Lobby
          socket={socket}
          isInLobby={isInLobby}
          players={gameState.players}
          t={t}
          myPlayerId={myPlayerId}
        />
      )}

      {isPlaying && (
        <GameBoard
          socket={socket}
          gameState={gameState}
          myId={myPlayerId}
          t={t}
        />
      )}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 3000 }}>
        <button
          onClick={() => {
            if (confirm('Tüm bilgilerini silip çıkmak istiyor musun?')) {
              // Notify server to remove me, wait for ACK
              socket.emit('leaveGame', { playerId: myPlayerId }, () => {
                // Clear ALL localStorage data
                localStorage.removeItem('uno_player_id');
                localStorage.removeItem('uno_player_name');

                // Reload after a brief delay to ensure cleanup
                setTimeout(() => window.location.reload(), 100);
              });

              // Fallback if server doesn't respond fast
              setTimeout(() => {
                localStorage.removeItem('uno_player_id');
                localStorage.removeItem('uno_player_name');
                window.location.reload();
              }, 500);
            }
          }}
          style={{
            background: 'rgba(255,0,0,0.5)',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          🗑️ Çıkış Yap / Sıfırla
        </button>
      </div>
    </>
  );
}

export default App;
