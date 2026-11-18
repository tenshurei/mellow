const express = require('express');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    const playerId = req.query.playerIdentifier || 'Bilinmeyen Oyuncu';

    const petData = {
        name: 'Mochi',
        type: 'Kedi',
        level: 4,
        stats: {
            hunger: 80,
            energy: 60,
            happiness: 90
        }
    };

    res.render('index', { player: playerId, pet: petData });
});

module.exports = app;