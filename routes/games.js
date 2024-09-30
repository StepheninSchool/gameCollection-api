import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { promises as fsPromises } from 'fs';

const router = express.Router();

// Multer setup: Configuring storage settings for file uploads
const storage = multer.diskStorage({
  // Set the destination directory for uploaded files
  destination: function (req, file, cb) {
    cb(null, 'public/images/'); // Save uploaded files in the `public/images` folder
  },
  // Generate a unique filename for each uploaded file
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop(); // get file extension
    const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1000) + '.' + ext; // generate unique filename - current timestamp + random number between 0 and 1000.
    cb(null, uniqueFilename);
  }
});
const upload = multer({ storage: storage }); // Initialize multer with the storage settings

// Prisma setup: Creating a Prisma client for database interactions
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], // Enable logging for database queries and errors
});

// Regex patterns for validation
const releaseDatePattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-(\d{4})$/; // mm-dd-yyyy format
const titlePattern = /^[a-zA-Z0-9\s]{1,100}$/; // Title: 1-100 alphanumeric characters
const descriptionPattern = /^[\s\S]{1,500}$/; // Description: 1-500 characters
const developerPattern = /^[a-zA-Z0-9\s]{1,100}$/; // Developer: 1-100 alphanumeric characters
const publisherPattern = /^[a-zA-Z0-9\s]{1,100}$/; // Publisher: 1-100 alphanumeric characters

// Create a new game: API endpoint for adding a game
router.post('/create', upload.single('image'), async (req, res) => {
  const { title, description, developer, publisher, releaseDate, completed } = req.body;

  // Validate required fields to ensure data integrity
  if (!title || !description || !developer || !publisher || !releaseDate) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Additional validation for each field
  if (!titlePattern.test(title)) {
    return res.status(400).json({ error: 'Invalid title format. Use 1-100 alphanumeric characters.' });
  }
  if (!descriptionPattern.test(description)) {
    return res.status(400).json({ error: 'Invalid description format. Use up to 500 characters.' });
  }
  if (!developerPattern.test(developer)) {
    return res.status(400).json({ error: 'Invalid developer format. Use 1-100 alphanumeric characters.' });
  }
  if (!publisherPattern.test(publisher)) {
    return res.status(400).json({ error: 'Invalid publisher format. Use 1-100 alphanumeric characters.' });
  }
  if (!releaseDatePattern.test(releaseDate)) {
    return res.status(400).json({ error: 'Invalid release date: must be in the format mm-dd-yyyy.' });
  }

  const filename = req.file ? req.file.filename : null; // Get the uploaded file's filename if present

  // Ensure 'completed' is a boolean value
  const completedBool = completed === 'true'; // Convert string to boolean

  // Create a new game record in the database
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

  // Respond with success message and the created game data
  res.status(200).json({ message: 'Game added successfully!', data: game });
});

// Read all games
router.get('/photo/all', async (req, res) => {
  const games = await prisma.game.findMany(); // Fetch all game records from the database
  res.status(200).json(games); // Respond with the retrieved games
});

// Read game by ID
router.get('/photo/read/:id', async (req, res) => {
  const id = req.params.id; // Get the game ID from the request parameters

  // Validate that the ID is a number
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid game id.' });
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: parseInt(id) }, // Look for the game with the specified ID
    });

    // If the game is not found, respond with a 404 error
    if (!game) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    // Respond with the found game data
    res.status(200).json({ message: `Successfully found game with id ${id} - ${game.title}`, data: game });
  } catch (error) {
    // Handle any errors that occur during the database query
    res.status(500).json({ error: 'Error fetching the game.' });
  }
});

// Update a game by ID
router.put('/photo/update/:id', upload.single('image'), async (req, res) => {
  const id = req.params.id; // Get the game ID from the request parameters

  // Validate that the ID is a number
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid game id.' });
  }

  // Fetch the existing game record from the database
  const existingGame = await prisma.game.findUnique({
    where: { id: parseInt(id) },
  });

  // If the game does not exist, respond with a 404 error
  if (!existingGame) {
    return res.status(404).json({ error: 'Game not found.' });
  }

  const { title, description, developer, publisher, releaseDate, completed } = req.body; // Get updated data from the request

  // Validate that at least one field is provided for the update
  if (!title && !description && !developer && !publisher && !releaseDate && !req.file) {
    return res.status(400).json({ error: 'At least one field must be provided for update.' });
  }

  // Additional validation for fields provided in the update
  if (title && !titlePattern.test(title)) {
    return res.status(400).json({ error: 'Invalid title format. Use 1-100 alphanumeric characters.' });
  }
  if (description && !descriptionPattern.test(description)) {
    return res.status(400).json({ error: 'Invalid description format. Use up to 500 characters.' });
  }
  if (developer && !developerPattern.test(developer)) {
    return res.status(400).json({ error: 'Invalid developer format. Use 1-100 alphanumeric characters.' });
  }
  if (publisher && !publisherPattern.test(publisher)) {
    return res.status(400).json({ error: 'Invalid publisher format. Use 1-100 alphanumeric characters.' });
  }
  if (releaseDate && !releaseDatePattern.test(releaseDate)) {
    return res.status(400).json({ error: 'Invalid release date format. Use mm-dd-yyyy.' });
  }

  // If a new image file is uploaded, delete the old image file
  //SOURCE: https://nodejs.org/docs/latest/api/fs.html#fspromisesunlinkpath
  if (req.file && existingGame.filename) {
    const oldFilePath = path.join('public/images', existingGame.filename); // Construct the file path of the old image

    // Check if the old file exists
    if (fs.existsSync(oldFilePath)) {
      try {
        await fsPromises.unlink(oldFilePath); // Delete the old file asynchronously
        console.log(`Deleted old image file: ${oldFilePath}`);
      } catch (error) {
        console.error(`Error deleting old image file: ${error.message}`);
        return res.status(500).json({ error: 'Error deleting old image file.' });
      }
    } else {
      console.log(`Old image file does not exist: ${oldFilePath}`);
    }
  }

  // Update the game record with new data
  const updatedGame = await prisma.game.update({
    where: { id: parseInt(id) },
    data: {
      title: title || existingGame.title,
      description: description || existingGame.description,
      developer: developer || existingGame.developer,
      publisher: publisher || existingGame.publisher,
      releaseDate: releaseDate || existingGame.releaseDate,
      completed: completed === 'true' || existingGame.completed,
      filename: req.file ? req.file.filename : existingGame.filename,
    },
  });

  // Respond with success message and the updated game data
  res.status(200).json({ message: 'Game updated successfully!', data: updatedGame });
});

// Delete a game by ID: //https://nodejs.org/docs/latest/api/fs.html
router.delete('/delete/:id', async (req, res) => {
  const id = req.params.id; // Get the game ID from the request parameters

  // Validate that the ID is a number
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid game id.' });
  }

  try {
    // Find the game by ID
    const game = await prisma.game.findUnique({
      where: { id: parseInt(id) },
    });

    // If the game is not found, respond with a 404 error
    if (!game) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    // Delete the game record from the database
    await prisma.game.delete({
      where: { id: parseInt(id) },
    });

    // If the game has an associated image file, delete it if it exists
    //SOURCE: https://nodejs.org/docs/latest/api/fs.html#fspromisesunlinkpath
    if (game.filename) {
      const filePath = path.join('public/images', game.filename); // Construct the file path of the image
      if (fs.existsSync(filePath)) {
        await fsPromises.unlink(filePath); // Delete the image file asynchronously
      }
    }

    // Respond with success message indicating the game has been deleted
    res.status(200).json({
      message: `Successfully deleted game with id ${id} - ${game.title}`,
    });

  } catch (error) {
    console.error('Error deleting game:', error); // Log any errors that occur
    res.status(500).json({ error: 'Error deleting the game.' }); // Respond with a 500 error
  }
});

// Export the router to be used in the main application
export default router;
