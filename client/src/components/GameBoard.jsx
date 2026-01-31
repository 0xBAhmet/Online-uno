import React, { useState } from 'react';

const Card = ({ card, onClick, className = '' }) => {
    if (!card) return null;

    // Convert API values to readable/CSS classes
    const colorClass = `card-${card.color}`;
    let displayValue = card.value.toString(); // Ensure string

    // Icons/Symbols (Simplified)
    if (card.value === 'skip') displayValue = '⊘';
    if (card.value === 'reverse') displayValue = '⇄';
    if (card.value === 'draw_two') displayValue = '+2';
    if (card.value === 'wild') displayValue = '🌈';
    if (card.value === 'wild_draw_four') displayValue = '+4';

    return (
        <div className={`uno-card ${colorClass} ${className} ${card.type === 'wild' ? 'wild' : ''}`} onClick={onClick}>
            <span className="small-number top-left">{displayValue}</span>
            <span className="card-value">{displayValue}</span>
            <span className="small-number bottom-right">{displayValue}</span>
        </div>
    );
};

const GameBoard = ({ socket, gameState, myId }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingCardIndex, setPendingCardIndex] = useState(null);

    const myPlayer = gameState.players.find(p => p.id === myId);
    const opponents = gameState.players.filter(p => p.id !== myId);

    // Rotate opponents array so play direction visualization is easier? 
    // For now simple list.

    const handleCardClick = (index, card) => {
        if (gameState.currentPlayer !== myId) return; // Not my turn

        if (card.type === 'wild' || card.value === 'wild_draw_four') {
            setPendingCardIndex(index);
            setShowColorPicker(true);
        } else {
            socket.emit('playCard', { cardIndex: index });
        }
    };

    const handleColorSelect = (color) => {
        socket.emit('playCard', { cardIndex: pendingCardIndex, declaredColor: color });
        setShowColorPicker(false);
        setPendingCardIndex(null);
    };

    const handleDraw = () => {
        if (gameState.currentPlayer !== myId) return;
        socket.emit('drawCard');
    };

    const isMyTurn = gameState.currentPlayer === myId;

    return (
        <div className="game-board" style={{ position: 'relative' }}>
            {/* Top Right: End Game Button */}
            <button
                onClick={() => {
                    if (confirm('Are you sure you want to end the game for everyone?')) {
                        socket.emit('returnToLobby');
                    }
                }}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    padding: '8px 16px',
                    background: 'rgba(255, 82, 82, 0.8)', // Red
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    zIndex: 1000,
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                }}
            >
                End Game
            </button>

            {/* Top: Opponents */}
            <div className="opponents-zone">
                {opponents.map(p => (
                    <div key={p.id} className="opponent-card glass-panel">
                        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>{p.name}</div>
                        <div className="opponent-hand-stack">
                            {Array.from({ length: Math.min(p.handCount, 10) }).map((_, i) => (
                                <div key={i} className="mini-card-back" style={{ transform: `rotate(${i * 2}deg)` }}></div>
                            ))}
                        </div>
                        <div style={{ marginTop: '5px' }}>× {p.handCount}</div>
                        {gameState.currentPlayer === p.id && <div style={{ color: 'lime', fontWeight: 'bold' }}>Thinking...</div>}
                    </div>
                ))}
            </div>

            {/* Middle: Play Area */}
            <div className="play-zone">
                <div className="deck-pile" onClick={handleDraw}>
                    {/* Deck Graphic in CSS */}
                    {gameState.accumulatedDraw > 0 && (
                        <div style={{
                            position: 'absolute',
                            color: 'red',
                            background: 'white',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontWeight: 'bold',
                            boxShadow: '0 0 10px red',
                            zIndex: 10
                        }}>
                            +{gameState.accumulatedDraw}
                        </div>
                    )}
                </div>

                <div className="discard-pile" style={{
                    boxShadow: gameState.currentColor && gameState.currentColor !== 'wild'
                        ? `0 0 20px 5px var(--card-${gameState.currentColor})`
                        : 'none',
                    transition: 'box-shadow 0.5s ease'
                }}>
                    <Card card={gameState.topCard} />
                    {/* Explicit Color Indicator for Wilds */}
                    {gameState.topCard?.type === 'wild' && gameState.currentColor && gameState.currentColor !== 'wild' && (
                        <div style={{
                            position: 'absolute',
                            bottom: '-40px',
                            background: `var(--card-${gameState.currentColor})`,
                            padding: '5px 10px',
                            borderRadius: '20px',
                            color: gameState.currentColor === 'yellow' ? 'black' : 'white',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                        }}>
                            Color: {gameState.currentColor.toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: My Hand */}
            <div className="player-hand-container">
                {isMyTurn && <div className="turn-indicator active-turn">YOUR TURN</div>}

                <div className="player-hand">
                    {myPlayer && myPlayer.hand && myPlayer.hand.map((card, index) => (
                        <div key={card.id || index} className="hand-card-wrapper" style={{ zIndex: index }}>
                            <Card
                                card={card}
                                onClick={() => handleCardClick(index, card)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Color Picker Modal */}
            {showColorPicker && (
                <div className="color-picker-overlay">
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <h2>Choose Color</h2>
                        <div className="color-options">
                            <button className="color-btn" style={{ background: 'var(--card-red)' }} onClick={() => handleColorSelect('red')}></button>
                            <button className="color-btn" style={{ background: 'var(--card-blue)' }} onClick={() => handleColorSelect('blue')}></button>
                            <button className="color-btn" style={{ background: 'var(--card-green)' }} onClick={() => handleColorSelect('green')}></button>
                            <button className="color-btn" style={{ background: 'var(--card-yellow)' }} onClick={() => handleColorSelect('yellow')}></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Over / Status Messages could go here */}
        </div>
    );
};

export default GameBoard;
