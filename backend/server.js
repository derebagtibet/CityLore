const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { getJwtSecret } = require('./config/jwt');
try {
  getJwtSecret();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
]
  .filter(Boolean);

const vercelOriginPattern = /^https:\/\/.*\.vercel\.app$/;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return vercelOriginPattern.test(origin);
}

function corsOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked for origin: ${origin}`));
}

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/places', require('./routes/places'));
app.use('/api/events', require('./routes/events'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/cities', require('./routes/cities'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/directions', require('./routes/directions'));

// Health check
app.get('/', (req, res) => res.json({ message: 'CityLore API running 🏛️' }));

// Socket.IO for real-time events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_city', (cityId) => {
    socket.join(`city_${cityId}`);
    console.log(`Socket ${socket.id} joined city_${cityId}`);
  });

  socket.on('leave_city', (cityId) => {
    socket.leave(`city_${cityId}`);
  });

  socket.on('new_event', (eventData) => {
    // Broadcast to all users in that city
    socket.to(`city_${eventData.cityId}`).emit('event_added', eventData);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const port = Number(process.env.PORT) || 5000;
    server
      .listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);
      })
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(
            `❌ Port ${port} is already in use. Stop the other Node/backend process or set a different PORT in backend/.env.`
          );
        } else {
          console.error('❌ Server listen error:', err.message);
        }
        process.exit(1);
      });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
