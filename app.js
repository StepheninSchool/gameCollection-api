import express from 'express';
import gamesRoute from './routes/games.js';

const port = process.env.PORT || 3000;
const app = express();

// Middleware

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes

app.use('/api', gamesRoute);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

