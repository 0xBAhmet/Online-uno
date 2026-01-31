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

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send initial state so client stops loading
    socket.emit('gameState', game.getGameStateForPlayer(null));

    socket.on('joinGame', ({ username, playerId }) => {
        // playerId is the stable UUID from client
        const result = game.addPlayer(socket.id, username, playerId);

        if (result.success) {
            socket.join(game.id); // Valid for both new and reconnect

            // Broadcast generic state
            io.to(game.id).emit('gameState', game.getGameStateForPlayer(null));

            // Send specific state to each player
            game.players.forEach(p => {
                if (p.connected && p.socketId) {
                    io.to(p.socketId).emit('gameState', game.getGameStateForPlayer(p.id));
                }
            });
        } else {
            socket.emit('error', result.message || 'Could not join game');
        }
    });

    socket.on('startGame', () => {
        const success = game.start();
        if (success) {
            game.players.forEach(p => {
                if (p.connected && p.socketId) io.to(p.socketId).emit('gameState', game.getGameStateForPlayer(p.id));
            });
        }
    });

    socket.on('playCard', ({ cardIndex, declaredColor }) => {
        // Find player by socketId to get stableId
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) return;

        const result = game.playCard(player.id, cardIndex, declaredColor);
        if (result.success) {
            if (game.status === 'finished') {
                io.to(game.id).emit('gameOver', { winner: result.winner });
            }
            game.players.forEach(p => {
                if (p.connected && p.socketId) io.to(p.socketId).emit('gameState', game.getGameStateForPlayer(p.id));
            });
        } else {
            socket.emit('error', result.message);
        }
    });

    socket.on('drawCard', () => {
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) return;

        game.playerDraw(player.id);
        game.players.forEach(p => {
            if (p.connected && p.socketId) io.to(p.socketId).emit('gameState', game.getGameStateForPlayer(p.id));
        });
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
        if (!player) return;

        const kicked = game.voteKick(targetId, player.id);

        // Broadcast update
        game.players.forEach(p => {
            if (p.connected && p.socketId) io.to(p.socketId).emit('gameState', game.getGameStateForPlayer(p.id));
        });

        // If kicked, we might want to notify specifically, but gameState update implies removal
    });

    socket.on('leaveGame', (data, callback) => {
        const player = game.players.find(p => p.socketId === socket.id);
        if (player) {
            console.log('Player left explicitly:', player.name);
            game.removePlayer(player.id);
            io.emit('gameState', game.getGameStateForPlayer(null)); // Broadcast to all
        }
        // Acknowledge receipt
        if (typeof callback === 'function') callback();
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        game.handleDisconnect(socket.id);
        io.to(game.id).emit('gameState', game.getGameStateForPlayer(null));

        // Note: We don't delete game immediately anymore to allow reconnect
        // maybe set a timeout? For now, infinite wait.
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
