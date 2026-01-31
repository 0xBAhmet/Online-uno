const { Game } = require('./server/gameLogic');

const game = new Game('test2');
game.addPlayer('p1', 'Player 1');
game.addPlayer('p2', 'Player 2');
game.start();

// Find Cards
const wild4 = game.deck.cards.find(c => c.value === 'wild_draw_four');
const redDraw2 = game.deck.cards.find(c => c.value === 'draw_two' && c.color === 'red');
const blueDraw2 = game.deck.cards.find(c => c.value === 'draw_two' && c.color === 'blue');

game.players[0].hand = [wild4, { color: 'red', value: '1', type: 'number' }]; // P1 has +4 and extra card (don't win)
game.players[1].hand = [redDraw2, blueDraw2]; // P2 has Red +2 and Blue +2

// P1 starts
game.currentPlayerIndex = 0;

console.log('--- Test 2 Start ---');

// P1 plays +4 and declares RED
console.log('P1 plays +4 (Red)');
game.playCard('p1', 0, 'red'); // declaring red
console.log('Acc:', game.accumulatedDraw);
console.log('Current Color:', game.currentColor);

// P2 tries to play BLUE +2 (Should FAIL)
console.log('P2 tries Blue +2 on Red +4 (Should Fail)');
const failRes = game.playCard('p2', 1); // index 1 is blue
console.log('Result (Fail):', failRes);

// P2 plays RED +2 (Should SUCCESS)
console.log('P2 plays Red +2 on Red +4 (Should Success)');
const successRes = game.playCard('p2', 0); // index 0 is red
console.log('Result (Success):', successRes);
console.log('Acc:', game.accumulatedDraw);

if (game.accumulatedDraw === 6) {
    console.log('PASS: Stacking +2 on +4 worked (4+2=6)');
} else {
    console.log('FAIL: Stacking failed');
}
