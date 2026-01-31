import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

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

  const t = translations[language];

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      setServerError('');

      // Don't auto-rejoin here - wait for gameState to decide
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('gameState', (state) => {
      // Auto-rejoin ONLY if we're already in the players list but disconnected
      if (myPlayerId && state?.players) {
        const existingPlayer = state.players.find(p => p.id === myPlayerId);
        if (existingPlayer && !existingPlayer.connected) {
          socket.emit('joinGame', {
            username: localStorage.getItem('uno_player_name') || existingPlayer.name || 'Player',
            playerId: myPlayerId
          });
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
          <div className="loading-card red scale-up-center">UNO</div>
          <div className="loading-card blue scale-up-center" style={{ animationDelay: '0.2s' }}>UNO</div>
          <div className="loading-card green scale-up-center" style={{ animationDelay: '0.4s' }}>UNO</div>
        </div>
        <h2 style={{ marginTop: '2rem', color: 'white' }}>{t.loading}...</h2>
        <p style={{ color: isConnected ? '#4caf50' : '#f44336' }}>
          {isConnected ? '✓ Server Connected' : '⚠ Connecting to Server...'}
        </p>
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

      {/* Language Toggle */}
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
          myId={myPlayerId} // Using Stable ID now
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
