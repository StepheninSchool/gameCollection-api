import express from 'express';
import gamesRouter from './Routes/gamesRoute.js';

const port = process.env.PORT || 3000;
const app = express();

// Middleware

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes

app.use('/api/games', gamesRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});