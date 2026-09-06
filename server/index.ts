import express, { type Request, type Response } from 'express';
import cors from 'cors';
import patientRoutes from './routes/patientRoutes';
import clinicalRoutes from './routes/clinicalRoutes';
import { sse } from './services/sse';
import { db } from './services/db';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Simple request logger
app.use((req: Request, _res: Response, next) => {
  if (!req.url.startsWith('/api/events')) {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// SSE Real-Time Event Stream
app.get('/api/events', (req: Request, res: Response): void => {
  const clientId = sse.addClient(res);
  console.log(`[SSE] Client connected: ${clientId} (Total active: ${sse.getActiveClientCount()})`);
});

// API Routes
app.use('/api/patients', patientRoutes);
app.use('/api', clinicalRoutes);

// 404 handler for API routes
app.use('/api', (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `API route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: unknown): void => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server
const server = app.listen(PORT, () => {
  const stats = db.getStats();
  console.log('====================================================');
  console.log(`🏥 Medico Backend Server Live!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📊 Loaded ${stats.total} patient cases (${stats.emergency} Emergency, ${stats.urgent} Urgent)`);
  console.log(`🔗 ABDM Sandbox M1/M2: Ready | HIS Gateway: Ready`);
  console.log('====================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
