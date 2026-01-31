import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

const socket = io('https://jimmyhummluk-uno-online.hf.space'); // Ensure this matches server port

function App() {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [winner, setWinner] = useState(null);

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
      {winner && (
        <div className="color-picker-overlay">
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <h1>GAME OVER</h1>
            <h2>Winner: {gameState.players.find(p => p.id === winner)?.name || 'Unknown'}</h2>
            <button className="btn-primary" onClick={() => {
              socket.emit('returnToLobby');
              setWinner(null);
            }}>Return to Lobby</button>
          </div>
        </div>
      )}

      {isInLobby && (
        <Lobby
          socket={socket}
          isInLobby={isInLobby}
          players={gameState.players}
        />
      )}

      {isPlaying && (
        <GameBoard
          socket={socket}
          gameState={gameState}
          myId={socket.id}
        />
      )}
    </>
  );
}

export default App;
