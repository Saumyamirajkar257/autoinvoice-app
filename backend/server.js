require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// Cache-control for GET API responses
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, max-age=5');
  }
  next();
});

// API Routes
app.use('/api', routes);

// Root health check route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'AutoInvoice Backend API is running',
    version: '2.0.0',
    features: [
      'Invoice Management',
      'Client Management', 
      'Email Delivery',
      'Payment Verification',
      'Activity Timeline',
      'Payment Reminders'
    ]
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 AutoInvoice Backend v2.0 running on port ${PORT}`);
  console.log(`📍 API base URL: http://localhost:${PORT}/api`);
  console.log(`📧 Email provider: ${process.env.EMAIL_PROVIDER || 'smtp'}`);
  console.log(`=============================================`);
});
