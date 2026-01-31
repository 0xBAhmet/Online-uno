import React, { useState } from 'react';

const Lobby = ({ socket, isInLobby, players = [], t }) => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleJoin = (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        socket.emit('joinGame', { username });
    };

    const handleStart = () => {
        socket.emit('startGame');
    };

    if (!isInLobby) return null; // Should be handled by parent, but safety check

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">UNO ONLINE</h1>

            {!players.find(p => p.id === socket.id) ? (
                <form onSubmit={handleJoin} className="lobby-form glass-panel">
                    <h2>{t.joinGame}</h2>
                    <input
                        type="text"
                        placeholder={t.enterName}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="input-field"
                    />
                    <button type="submit" className="btn-primary">{t.joinGame}</button>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                </form>
            ) : (
                <div className="lobby-form glass-panel" style={{ width: '400px' }}>
                    <h2>{t.players}</h2>
                    <ul className="player-list">
                        {players.map((p, index) => (
                            <li key={index} className="player-item">
                                <span>{p.name} {p.id === socket.id ? '(You)' : ''}</span>
                                <span style={{ color: '#aaa' }}>Ready</span>
                            </li>
                        ))}
                    </ul>
                    {players.length >= 2 ? (
                        <button onClick={handleStart} className="btn-primary btn-success">{t.startGame}</button>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#aaa' }}>{t.waitingForPlayers} ({players.length}/4)...</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Lobby;
