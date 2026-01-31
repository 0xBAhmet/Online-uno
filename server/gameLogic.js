class Card {
    constructor(color, value, type) {
        this.id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36); // Unique ID
        this.color = color; // 'red', 'blue', 'green', 'yellow', 'wild'
        this.value = value; // 0-9, 'skip', 'reverse', 'draw_two', 'wild', 'wild_draw_four'
        this.type = type;   // 'number', 'action', 'wild'
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        const colors = ['red', 'blue', 'green', 'yellow'];
        const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw_two'];

        for (const color of colors) {
            // One 0 per color
            this.cards.push(new Card(color, '0', 'number'));

            // Two of 1-9 and action cards per color
            for (let i = 1; i < values.length; i++) {
                const value = values[i];
                const type = ['skip', 'reverse', 'draw_two'].includes(value) ? 'action' : 'number';
                this.cards.push(new Card(color, value, type));
                this.cards.push(new Card(color, value, type));
            }
        }

        // Wild cards (4 each)
        for (let i = 0; i < 4; i++) {
            this.cards.push(new Card('wild', 'wild', 'wild'));
            this.cards.push(new Card('wild', 'wild_draw_four', 'wild'));
        }

        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }

    get count() {
        return this.cards.length;
    }
}

class Game {
    constructor(id) {
        this.id = id;
        this.players = []; // { id, name, hand: [] }
        this.deck = new Deck();
        this.discardPile = [];
        this.currentPlayerIndex = 0;
        this.direction = 1; // 1 for clockwise, -1 for counter-clockwise
        this.status = 'waiting'; // 'waiting', 'playing', 'finished'
        this.currentColor = null; // Used for wild cards
        this.accumulatedDraw = 0; // NEW: Track stacked draws
    }

    /**
     * @param {string} socketId - Ephemeral Socket ID
     * @param {string} name - Player Name
     * @param {string} stableId - Persistent Client ID (UUID)
     */
    addPlayer(socketId, name, stableId) {
        // Fallback for backward compatibility or missing ID
        const logicId = stableId || socketId;

        // Check if player exists (Reconnection)
        const existingPlayer = this.players.find(p => p.id === logicId);

        if (existingPlayer) {
            // Reconnect
            existingPlayer.socketId = socketId;
            existingPlayer.connected = true;
            existingPlayer.name = name; // Update name if changed
            return { success: true, isReconnect: true };
        }

        if (this.status !== 'waiting') return { success: false, message: 'Game started' };

        // If room is full, check for disconnected players to replace
        if (this.players.length >= 4) {
            const disconnectedPlayer = this.players.find(p => !p.connected);
            if (disconnectedPlayer) {
                console.log('Auto-removing disconnected player:', disconnectedPlayer.name);
                this.removePlayer(disconnectedPlayer.id);
            } else {
                return { success: false, message: 'Room full' };
            }
        }

        // Add new player
        // id = logicId (Logic ID), socketId = transport ID
        this.players.push({
            id: logicId,
            socketId: socketId,
            name,
            hand: [],
            score: 0,
            connected: true
        });
        return { success: true, isReconnect: false };
    }

    handleDisconnect(socketId) {
        const player = this.players.find(p => p.socketId === socketId);
        if (player) {
            player.connected = false;
        }
        // Do NOT remove player. Wait for reconnect or kick.
        // If all players disconnect, maybe reset? For now, keep state.
    }

    // Returns true if kicked
    voteKick(targetId, voterId) {
        const target = this.players.find(p => p.id === targetId);
        const voter = this.players.find(p => p.id === voterId);

        if (!target || !voter) return false;
        if (targetId === voterId) return false; // Can't kick self

        // Initialize votes if needed
        if (!target.kickVotes) target.kickVotes = [];

        // Toggle vote (if already voted, remove vote? Or just add. Let's strictly add for now)
        if (!target.kickVotes.includes(voterId)) {
            target.kickVotes.push(voterId);
        }

        // Check Threshold: > 50% of *Connected* players (excluding target?) 
        // User rule: "oy birliğiyle" (unanimous?) or "oylama başlatıp".
        // Let's use Majority (>50%).
        const connectedPlayers = this.players.filter(p => p.connected).length;
        const votesNeeded = Math.floor(connectedPlayers / 2) + 1;

        if (target.kickVotes.length >= votesNeeded) {
            this.removePlayer(targetId);
            return true;
        }
        return false;
    }

    // Explicit Kick or Timeout
    removePlayer(stableId) {
        const playerIndex = this.players.findIndex(p => p.id === stableId);
        if (playerIndex === -1) return;

        const player = this.players[playerIndex];

        // If it was this player's turn, advance turn
        if (this.status === 'playing' && playerIndex === this.currentPlayerIndex) {
            this.advanceTurn();
        }

        this.players = this.players.filter(p => p.id !== stableId);

        // Clear votes from this player on others? Optional.
        this.players.forEach(p => {
            if (p.kickVotes) p.kickVotes = p.kickVotes.filter(vID => vID !== stableId);
        });

        if (this.players.length === 0) {
            this.resetGame();
        }
    }

    resetGame() {
        this.status = 'waiting';
        this.players = [];
        this.deck.reset();
        this.discardPile = [];
        this.currentPlayerIndex = 0;
        this.direction = 1;
        this.accumulatedDraw = 0;
    }

    restart() {
        // Reset game state but keep players AND SCORES
        this.status = 'waiting';
        this.deck.reset();
        this.discardPile = [];
        this.currentPlayerIndex = 0;
        this.direction = 1;
        this.accumulatedDraw = 0;
        this.players.forEach(p => p.hand = []);
    }

    start() {
        if (this.players.length < 2) return false;
        this.deck.reset();
        this.distributeCards();
        this.accumulatedDraw = 0;

        // Initial discard logic
        let firstCard = this.deck.draw();
        while (firstCard.type === 'wild') { // Reshuffle if first card is wild (simplification)
            this.deck.cards.unshift(firstCard);
            this.deck.shuffle();
            firstCard = this.deck.draw();
        }
        this.discardPile.push(firstCard);
        this.currentColor = firstCard.color;

        this.status = 'playing';
        return true;
    }

    distributeCards() {
        for (const player of this.players) {
            player.hand = [];
            for (let i = 0; i < 7; i++) {
                player.hand.push(this.deck.draw());
            }
        }
    }

    playCard(playerId, cardIndex, declaredColor = null) {
        if (this.status !== 'playing') return { success: false, message: 'Game not active' };

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentPlayerIndex) return { success: false, message: 'Not your turn' };

        const player = this.players[playerIndex];
        const card = player.hand[cardIndex];
        const topCard = this.discardPile[this.discardPile.length - 1];

        // Validation logic with stacking
        let isValid = false;

        if (this.accumulatedDraw > 0) {
            // Must play a +2 or +4 to stack
            if (card.value === 'draw_two') {
                // Can stack +2 on +2 or +4 (if color matches) - "UCU AÇIK" rule interpretation:
                // Rule: "2x atıldı ve yerde 4x var eğerki seçilen renk ile atılacak olan 2x'in rengi aynıysa atılabilir"
                // This implies strict stacking: +2 can go on +4 ONLY if color matches.
                // +2 on +2 is always valid if standard Uno rules apply (color or value match).

                if (topCard.value === 'wild_draw_four') {
                    isValid = card.color === this.currentColor;
                } else if (topCard.value === 'draw_two') {
                    isValid = true; // +2 on +2 is always valid
                }
            } else if (card.value === 'wild_draw_four') {
                isValid = true; // +4 can always be stacked (simplification)
            } else {
                return { success: false, message: `Must play +2 or +4 to defend against +${this.accumulatedDraw}` };
            }
        } else {
            // Standard validation
            const isColorMatch = card.color === this.currentColor;
            const isValueMatch = card.value === topCard.value && card.value !== 'wild' && card.value !== 'wild_draw_four';
            const isWild = card.type === 'wild';
            const isSameColorWhileWild = card.color !== 'wild' && card.color === this.currentColor;

            if (card.color === 'wild') {
                isValid = true;
            } else {
                isValid = card.color === this.currentColor || card.value === topCard.value;
            }
        }


        if (!isValid) return { success: false, message: 'Invalid move' };

        // Execute Move
        player.hand.splice(cardIndex, 1);
        this.discardPile.push(card);

        // Handle Card Effects
        if (card.type === 'wild') {
            this.currentColor = declaredColor; // Must be provided by client
        } else {
            this.currentColor = card.color;
        }

        if (card.value === 'skip') {
            this.advanceTurn();
        } else if (card.value === 'reverse') {
            this.direction *= -1;
            if (this.players.length === 2) { // Reverse acts like Skip in 2 player
                this.advanceTurn();
            }
        } else if (card.value === 'draw_two') {
            this.accumulatedDraw += 2;
            // Dont draw immediately, next player must respond or draw
        } else if (card.value === 'wild_draw_four') {
            this.accumulatedDraw += 4;
            // Dont draw immediately
        }

        // Check Win
        if (player.hand.length === 0) {
            this.status = 'finished';
            player.score += 1; // INCREMENT SCORE
            return { success: true, winner: player.id };
        }

        this.advanceTurn();
        return { success: true };
    }

    drawCards(player, count) {
        for (let i = 0; i < count; i++) {
            if (this.deck.count === 0) {
                // Reshuffle discard into deck (keep top card)
                if (this.discardPile.length > 1) {
                    const top = this.discardPile.pop();
                    this.deck.cards = this.discardPile; // Simplified, ideally create new Cards
                    this.discardPile = [top];
                    this.deck.shuffle();
                } else {
                    break; // No cards left
                }
            }
            player.hand.push(this.deck.draw());
        }
    }

    playerDraw(playerId) {
        if (this.status !== 'playing') return;
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentPlayerIndex) return;

        const player = this.players[playerIndex];

        if (this.accumulatedDraw > 0) {
            // Player accepts the stack penalty
            this.drawCards(player, this.accumulatedDraw);
            this.accumulatedDraw = 0;
            this.advanceTurn(); // Turn ends after drawing penalty
        } else {
            // Normal manual draw (1 card)
            this.drawCards(player, 1);
            // In some rules play passes, in others you can play the drawn card. 
            // Implementing "Draw passes turn" for simplicity and consistency with penalty draw.
            this.advanceTurn();
        }
        return { success: true };
    }

    getNextPlayer() {
        let nextIndex = this.currentPlayerIndex + this.direction;
        if (nextIndex >= this.players.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = this.players.length - 1;
        return this.players[nextIndex];
    }

    advanceTurn() {
        this.currentPlayerIndex += this.direction;
        if (this.currentPlayerIndex >= this.players.length) this.currentPlayerIndex = 0;
        if (this.currentPlayerIndex < 0) this.currentPlayerIndex = this.players.length - 1;
    }

    getGameStateForPlayer(playerId) {
        return {
            id: this.id,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                score: p.score || 0,
                isConnected: p.connected,
                voteCount: p.kickVotes ? p.kickVotes.length : 0,
                handCount: p.hand.length,
                hand: p.id === playerId ? p.hand : undefined
            })),
            topCard: this.discardPile[this.discardPile.length - 1],
            currentColor: this.currentColor,
            currentPlayer: this.players[this.currentPlayerIndex]?.id,
            status: this.status,
            direction: this.direction,
            accumulatedDraw: this.accumulatedDraw
        };
    }
}

module.exports = { Game };
