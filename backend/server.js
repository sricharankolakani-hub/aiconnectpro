// backend/server.js
try { require('dotenv').config(); } catch (e) { console.warn('dotenv not available'); }

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth'); // <- ensure this path exists

const app = express();

app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));

// mount routes under /api
app.use('/api/auth', authRoutes);

// other demo routes
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'AIConnect Pro backend running' }));
app.get('/', (req, res) => res.send('AIConnect Pro backend is live.'));

// start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
