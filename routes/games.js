import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/'); // save uploaded files in `public/images` folder
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop(); // get file extension
    const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1000) + '.' + ext; // generate unique filename
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

  if (games.length === 0) {
    res.status(400).send('No games available. Add to your history!');
    return;
  }
  res.json(games);
});

// Get a game by id
router.get('/get/:id', async (req, res) => {
  const id = req.params.id;

  // Validate id
  if (isNaN(id)) {
    res.status(400).send('Invalid game id.');
    return;
  }

  // Validate id
  if (isNaN(id)) {
    return res.status(400).send('Invalid game id.');
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: parseInt(id) },
    });

    if (game) {
      res.status(200).json({
        message: `Successfully found game with id ${id} - ${game.title}`,
        data: game,
      });
    } else {
      res.status(404).send('Game not found.');
    }
  } catch (error) {
    res.status(500).send('Error fetching the game.');
  }
});


// Add a new game
router.post('/add', upload.single('image'), async (req, res) => {
  const { title, description, developer, publisher, releaseDate, completed } = req.body;
  const filename = req.file ? req.file.filename : null;

  // Ensure 'completed' is a boolean value
  const completedBool = completed === true;

  // Regex for validating date format mm-dd-yyyy
  const releaseDatePattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;

  // Validate mm-dd-yyyy format for release date
  if (!releaseDatePattern.test(releaseDate)) {
    return res.status(400).send('Invalid release date: must be in the format mm-dd-yyyy.');
  }

  const game = await prisma.game.create({
    data: {
      title,
      description,
      developer,
      publisher,
      releaseDate,
      completed: completedBool,
      filename,
    },
  });

  res.json(game);
  res.status(200).send('Game added successfully!')
});

// Update a game by id (no required fields)
router.put('/update/:id', upload.single('image'), async (req, res) => {
  const id = req.params.id;

  // Validate id
  if (isNaN(id)) {
    return res.status(400).send('Invalid game id.');
  }

  // Find the game by id
  const existingGame = await prisma.game.findUnique({
    where: { id: parseInt(id) },
  });

  if (!existingGame) {
    return res.status(404).send('Game not found.');
  }

  // Capture the inputs
  const { title, description, developer, publisher, releaseDate, completed } = req.body;
  const filename = req.file ? req.file.filename : null;

  // Validate releaseDate format (if provided)
  const datePattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
  if (releaseDate && !datePattern.test(releaseDate)) {
    return res.status(400).send('Invalid release date format. Use mm-dd-yyyy.');
  }

  // Perform the update with the fields that were provided, and keep existing values for others
  const updatedGame = await prisma.game.update({
    where: { id: parseInt(id) },
    data: {
      title: title || existingGame.title,  // Use provided title, or keep the existing one
      description: description || existingGame.description,  // Same for description
      developer: developer || existingGame.developer,  // Same for developer
      publisher: publisher || existingGame.publisher,  // Same for publisher
      releaseDate: releaseDate || existingGame.releaseDate,  // Same for releaseDate
      completed: typeof completed === 'undefined' ? existingGame.completed : completed === true,  // If completed is provided, use it; otherwise, keep the original value
      filename: filename || existingGame.filename,  // If a new file was uploaded, use it; otherwise, keep the old filename
    },
  });

  res.json(updatedGame);
});

// Delete a game by id
router.delete('/delete/:id', async (req, res) => {
  const id = req.params.id;

  // Verify id is a number
  if (isNaN(id)) {
    return res.status(400).send('Invalid game id.');
  }

  try {
    // Find the game by id
    const game = await prisma.game.findUnique({
      where: { id: parseInt(id) },
    });

    if (!game) {
      return res.status(404).send('Game not found.');
    }

    // Delete the record from the database
    await prisma.game.delete({
      where: { id: parseInt(id) },
    });

    // Check if the game has an associated image file and delete it if it exists
    if (game.filename) {
      const filePath = path.join('public/images', game.filename); // Use path.join for cross-platform compatibility

      // Check if file exists
      if (fs.existsSync(filePath)) {
        // Delete the file
        fs.unlinkSync(filePath);
      }
    }

    res.status(200).json({
      message: `Successfully deleted game with id ${id} - ${game.title}`,
    });

  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).send('Error deleting the game.');
  }
});

export default router;
