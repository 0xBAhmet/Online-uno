import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

import { translations } from './translations';

const socket = io('https://jimmyhummluk-uno-online.hf.space'); // Ensure this matches server port

function App() {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [winner, setWinner] = useState(null);
  const [language, setLanguage] = useState('tr'); // Default Turkish

  const t = translations[language];

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('gameState', (data) => {
      setGameState(data);
    });

    socket.on('gameOver', ({ winner }) => {
      setWinner(winner);
    });

    socket.on('error', (msg) => {
      alert(msg);
    });

    return () => {
      socket.off('connect');
      socket.off('gameState');
      socket.off('gameOver');
    };
  }, []);

  if (!gameState) return <div className="lobby-container"><h1 className='lobby-title'>Loading...</h1></div>;

  // Derived state for view switching
  const isInLobby = gameState.status === 'waiting';
  const isPlaying = gameState.status === 'playing' || gameState.status === 'finished';

  return (
    <>
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
        />
      )}

      {isPlaying && (
        <GameBoard
          socket={socket}
          gameState={gameState}
          myId={socket.id}
          t={t}
        />
      )}
    </>
  );
}

export default App;
