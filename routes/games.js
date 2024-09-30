import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/'); // save uploaded files in `public/images` folder
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop(); // get file extension
    const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1000) + '.' + ext; // generate unique filename - current timestamp + random number between 0 and 1000.
    cb(null, uniqueFilename);
  }
});
const upload = multer({ storage: storage });

// Prisma setup
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Get all played games
router.get('/all', async (req, res) => {
  const games = await prisma.game.findMany();

  // Check if any games are available
  if (games.length === 0) {
    res.status(400).send('No games available. Add to your history !');
    return;
  }
  else {
    res.json(games);
  }
});

// Get a game by id
router.get('/get/:id', async (req, res) => {
  const id = req.params.id;

  // Validate id
  if (isNaN(id)) {
    res.status(400).send('Invalid game id.');
    return;
  }

  const game = await prisma.game.findUnique({
    where: {
      id: parseInt(id),
    },
  });

  if (game) {
    res.json(game);
  } else {
    res.status(404).send('Game not found.');
  }
});

// Add a new game
router.post('/add', upload.single('image'), async (req, res) => {
  const { title, description, developer, publisher, releaseDate, completed } = req.body;
  const filename = req.file ? req.file.filename : null;

  //ensure 'completed' is a boolean value
  const completedBool = completed === "true"; 

  // to-do: validate proper publisher, developer etc

  const game = await prisma.game.create({
    data: {
      title: title,
      description: description,
      developer: developer,
      publisher: publisher, 
      releaseDate: releaseDate,
      completed: completed,
      filename: filename, 

    }
  });

  res.json(game)


});






















export default router;

