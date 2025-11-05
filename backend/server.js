// backend/server.js
// Minimal, robust Express server for Render
// Safe dotenv loading so missing module won't crash (but we recommend installing dotenv in package.json)
try {
  require('dotenv').config();
} catch (e) {
  // If dotenv isn't installed (temporary), keep running with environment variables
  console.warn('dotenv not available — continuing without .env');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security and body parsing
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));

// Basic health route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AIConnect Pro backend running' });
});

// Example demo route
app.get('/', (req, res) => {
  res.send('AIConnect Pro backend is live.');
});

// Start server and listen on the port Render provides
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
