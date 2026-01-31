const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Game } = require('./gameLogic');

const app = express();
app.use(cors());

const server = http.createServer(app);

app.get('/', (req, res) => {
    res.send('Uno Server is Running! 🚀');
});

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Simple single game instance for now
let game = new Game('room1');

// Constant-helper to broadcast state to all relevant players
const broadcastState = () => {
    game.players.forEach(p => {
        if (p.connected && p.socketId) {
            io.to(p.socketId).emit('gameState', game.getGameStateForPlayer(p.id));
        }
    });
};

io.on('connection', (socket) => {
    // Initial state emission for the individual socket (no global log here to avoid spam)
    socket.emit('gameState', game.getGameStateForPlayer(null));

    socket.on('joinGame', ({ username, playerId }) => {
        const result = game.addPlayer(socket.id, username, playerId);

        if (result.success) {
            socket.join(game.id);
            broadcastState();
        } else {
            socket.emit('error', result.message || 'Could not join game');
        }
    });

    socket.on('startGame', () => {
        if (game.start()) {
            broadcastState();
        }
    });

    socket.on('playCard', ({ cardIndex, declaredColor }) => {
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) return;

        const result = game.playCard(player.id, cardIndex, declaredColor);
        if (result.success) {
            if (game.status === 'finished') {
                io.to(game.id).emit('gameOver', { winner: result.winner });
            }
            broadcastState();
        } else {
            socket.emit('error', result.message);
        }
    });

    socket.on('drawCard', () => {
        const player = game.players.find(p => p.socketId === socket.id);
        if (player) {
            game.playerDraw(player.id);
            broadcastState();
        }
    });

    socket.on('returnToLobby', ({ isGameOver } = {}) => {
        const player = game.players.find(p => p.socketId === socket.id);
        // Note: Even disconnected players might trigger this locally if they reconnect? 
        // No, this is an action.

        if (isGameOver && game.status === 'playing') {
            socket.emit('gameState', game.getGameStateForPlayer(player ? player.id : null));
            return;
        }

        game.restart();
        io.to(game.id).emit('gameState', game.getGameStateForPlayer(null));
    });

    socket.on('voteKick', ({ targetId }) => {
        const player = game.players.find(p => p.socketId === socket.id);
        if (player && game.voteKick(targetId, player.id)) {
            // If someone was kicked, we could send a specific notification,
            // but broadcastState handles the removal from player lists.
        }
        broadcastState();
    });

    socket.on('leaveGame', (data, callback) => {
        // Try to find player by socket ID first, then by player ID from data
        let player = game.players.find(p => p.socketId === socket.id);
        if (!player && data && data.playerId) {
            player = game.players.find(p => p.id === data.playerId);
        }

        if (player) {
            game.removePlayer(player.id);
            broadcastState(); // Use room-safe broadcast
        }
        // Acknowledge receipt
        if (typeof callback === 'function') callback();
    });

    socket.on('disconnect', () => {
        game.handleDisconnect(socket.id);
        // Only broadcast to the game room
        io.to(game.id).emit('gameState', game.getGameStateForPlayer(null));
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
