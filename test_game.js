const { Game } = require('./server/gameLogic');

const game = new Game('test');
game.addPlayer('p1', 'Player 1');
game.addPlayer('p2', 'Player 2');
game.start();

// Cheat: Give P1 a +2 (Red) and P2 a +2 (Blue)
// Find +2 cards
const redDraw2 = game.deck.cards.find(c => c.value === 'draw_two' && c.color === 'red');
const blueDraw2 = game.deck.cards.find(c => c.value === 'draw_two' && c.color === 'blue');

// Assign to hands manually
game.players[0].hand = [redDraw2];
game.players[1].hand = [blueDraw2];

// Discard pile setup: Make sure top card allows Red +2 (e.g. Red 5)
game.discardPile = [{ color: 'red', value: '5', type: 'number' }];
game.currentColor = 'red';
game.players[0].hand.push({ color: 'red', value: '7', type: 'number' }); // buffer
game.currentPlayerIndex = 0; // P1 starts

console.log('--- Test Start ---');
console.log('Initial Acc:', game.accumulatedDraw);

// P1 plays Red +2
console.log('P1 plays Red +2');
const result1 = game.playCard('p1', 0); // index 0 is redDraw2
console.log('Result 1:', result1);
console.log('Acc after P1:', game.accumulatedDraw);

// P2 plays Blue +2 (Stacking)
console.log('P2 plays Blue +2');
// P2 hand has blueDraw2 at index 0
// Must validly stack on red +2 (value match)
const result2 = game.playCard('p2', 0);
console.log('Result 2:', result2);
console.log('Acc after P2:', game.accumulatedDraw);

if (game.accumulatedDraw === 4) {
    console.log('PASS: Stacking worked (2+2=4)');
} else {
    console.log('FAIL: Stacking failed');
}
