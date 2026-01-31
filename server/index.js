const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Game } = require('./gameLogic');

const app = express();
app.use(cors());

const server = http.createServer(app);
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

    socket.on('joinGame', ({ username }) => {
        const success = game.addPlayer(socket.id, username);
        if (success) {
            socket.join(game.id);
            io.to(game.id).emit('gameState', game.getGameStateForPlayer(null)); // Broadcast generic state (players list)

            // Send specific state to each player
            game.players.forEach(p => {
                io.to(p.id).emit('gameState', game.getGameStateForPlayer(p.id));
            });
        } else {
            socket.emit('error', 'Could not join game (Full or Started)');
        }
    });

    socket.on('startGame', () => {
        const success = game.start();
        if (success) {
            game.players.forEach(p => {
                io.to(p.id).emit('gameState', game.getGameStateForPlayer(p.id));
            });
        }
    });

    socket.on('playCard', ({ cardIndex, declaredColor }) => {
        const result = game.playCard(socket.id, cardIndex, declaredColor);
        if (result.success) {
            if (result.message) {
                // Game Over or special event
                if (game.status === 'finished') {
                    io.to(game.id).emit('gameOver', { winner: result.winner });
                }
            }
            game.players.forEach(p => {
                io.to(p.id).emit('gameState', game.getGameStateForPlayer(p.id));
            });
        } else {
            socket.emit('error', result.message);
        }
    });

    socket.on('drawCard', () => {
        game.playerDraw(socket.id);
        game.players.forEach(p => {
            io.to(p.id).emit('gameState', game.getGameStateForPlayer(p.id));
        });
    });

    socket.on('returnToLobby', () => {
        // Only host or first player should ideally trigger this, or vote. 
        // For simplicity, any player triggering this restarts for everyone.
        game.restart();
        io.to(game.id).emit('gameState', game.getGameStateForPlayer(null)); // Broadcast new lobby state
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        game.removePlayer(socket.id);
        io.to(game.id).emit('gameState', game.getGameStateForPlayer(null));
        // Logic for handling disconnect mid-game is tricky, resetting for now
        if (game.players.length === 0) { // Reset if empty
            game = new Game('room1');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
