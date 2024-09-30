import express from 'express';
import multer from 'multer';
import { promises as fsPromises } from 'fs';
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
    const now = new Date();
    const uniqueFilename = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}-${Math.round(Math.random() * 1000)}.${ext}`; // create a unique filename
    cb(null, uniqueFilename);
  }
});
const upload = multer({ storage: storage });

// Prisma setup
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Create a new game
router.post('/create', upload.single('image'), async (req, res) => {
  const { title, description, developer, publisher, releaseDate, completed } = req.body;

  // Validate required fields
  if (!title || !description || !developer || !publisher || !releaseDate) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const filename = req.file ? req.file.filename : null;

  // Ensure 'completed' is a boolean value
  const completedBool = completed === 'true'; // Convert to boolean

  // Validate date format (mm-dd-yyyy)
  const releaseDatePattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
  if (!releaseDatePattern.test(releaseDate)) {
    return res.status(400).json({ error: 'Invalid release date: must be in the format mm-dd-yyyy.' });
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

  res.status(200).json({ message: 'Game added successfully!', data: game });
});

// Functional Requirement 02: Read
// Read all games
router.get('/photo/all', async (req, res) => {
  const games = await prisma.game.findMany();
  res.status(200).json(games);
});

// Read game by id
router.get('/photo/read/:id', async (req, res) => {
  const id = req.params.id;

  // Validate id
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid game id.' });
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: parseInt(id) },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    res.status(200).json({ message: `Successfully found game with id ${id} - ${game.title}`, data: game });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching the game.' });
  }
});

// Update a game by id
router.put('/photo/update/:id', upload.single('image'), async (req, res) => {
  const id = req.params.id;

  // Validate id
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid game id.' });
  }

  const existingGame = await prisma.game.findUnique({
    where: { id: parseInt(id) },
  });

  if (!existingGame) {
    return res.status(404).json({ error: 'Game not found.' });
  }

  const { title, description, developer, publisher, releaseDate, completed } = req.body;
  const filename = req.file ? req.file.filename : null;

  // Validate required fields
  if (!title && !description && !developer && !publisher && !releaseDate && !req.file) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate releaseDate format only if it's provided
  if (releaseDate) {
    const datePattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
    if (!datePattern.test(releaseDate)) {
      return res.status(400).json({ error: 'Invalid release date format. Use mm-dd-yyyy.' });
    }
  }

  // Delete old image file if a new one is being uploaded
  if (req.file && existingGame.filename) {
    const oldFilePath = path.join('public/images', existingGame.filename);

    // Check if the old file exists
    if (fs.existsSync(oldFilePath)) {
      try {
        fs.unlinkSync(oldFilePath); // Delete the old file
        console.log(`Deleted old image file: ${oldFilePath}`);
      } catch (error) {
        console.error(`Error deleting old image file: ${error.message}`);
        return res.status(500).json({ error: 'Error deleting old image file.' });
      }
    } else {
      console.log(`Old image file does not exist: ${oldFilePath}`);
    }
  }


  const updatedGame = await prisma.game.update({
    where: { id: parseInt(id) },
    data: {
      title,
      description,
      developer,
      publisher,
      releaseDate,
      completed: completed === 'true',
      filename,
    },
  });

  res.status(200).json({ message: 'Game updated successfully!', data: updatedGame });
});

router.delete('/delete/:id', async (req, res) => {
  const id = req.params.id;

  // Verify id is a number
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid game id.' });
  }

  try {
    // Find the game by id
    const game = await prisma.game.findUnique({
      where: { id: parseInt(id) },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    // Delete the record from the database
    await prisma.game.delete({
      where: { id: parseInt(id) },
    });

    // Check if the game has an associated image file and delete it if it exists
    if (game.filename) {
      const filePath = path.join('public/images', game.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Delete the image file
      }
    }

    res.status(200).json({
      message: `Successfully deleted game with id ${id} - ${game.title}`,
    });

  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Error deleting the game.' });
  }
});


export default router;
