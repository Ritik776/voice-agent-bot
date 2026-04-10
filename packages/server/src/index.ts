import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { prisma } from './db';
import { conversationRouter } from './routes/conversation';
import { merchantRouter } from './routes/merchant';
import { setupVoiceSocket } from './voice/socket-handler';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/conversation', conversationRouter);
app.use('/api/v1/merchant', merchantRouter);

// WebSocket — voice pipeline
setupVoiceSocket(io);

const PORT = parseInt(process.env.PORT || '3001', 10);

httpServer.listen(PORT, () => {
  console.log(`[VoiceSell] Server running on http://localhost:${PORT}`);
  console.log(`[VoiceSell] Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  httpServer.close();
});
