const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const requireSession = require('./middleware/requireSession')
const { ipShield, userLimiter } = require('./middleware/limiters')
const { notFound, errorHandler } = require('./middleware/errorHandler')
const authRoutes = require('./modules/auth/routes/authRoutes')
const clientAdminRoutes = require('./modules/client-admin')
const salesRoutes = require('./modules/sales');
const superAdminRoutes = require('./modules/super-admin/index.js');
const requireRole = require('./middleware/requireRole')
const operationsRoutes = require('./modules/operations')
const publicRoutes = require('./modules/public')
const managerRoutes = require('./modules/manager')
const portalRoutes = require('./modules/portal')

const app = express();


app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  exposedHeaders: [
    'Retry-After',
    'RateLimit-Limit',
    'RateLimit-Remaining'
  ]
}));
app.use('/api/webhooks', require('./modules/webhooks/razorpayWebhook'))
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.get('/api/health', (req, res) => {
  
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1
      ? 'connected'
      : 'disconnected',
    dbName: mongoose.connection.name,
    time: new Date().toISOString()
  })
})
app.use('/api', ipShield)
app.use('/api/auth', authRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/portal', portalRoutes)
app.use('/api/super-admin', superAdminRoutes);
app.use('/api', requireSession)
app.use('/api', userLimiter)

app.use('/api', clientAdminRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/operations', operationsRoutes)
app.use('/api/manager', managerRoutes)
app.use('/api/customer-care', require('./modules/customer-care'))
app.use(notFound);
app.use(errorHandler);

module.exports = app;