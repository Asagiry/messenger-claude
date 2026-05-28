import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import dialogRoutes from './routes/dialogs';
import presenceRoutes from './routes/presence';
import { setupWebSocket } from './ws/hub';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dialogs', dialogRoutes);
app.use('/api/presence', presenceRoutes);

// Expose local uploads folder for downloaded avatars
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Serve frontend static
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^\/(?!api|ws).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
setupWebSocket(wss);

const PORT = parseInt(process.env.PORT || '80', 10);
server.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
