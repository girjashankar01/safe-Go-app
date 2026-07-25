import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import setupSocket from './socket/handlers.js';
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import sosRoutes from './routes/sos.js';
import trackHandler from './routes/track.js';
import directoryRoutes from './routes/directory.js';
import emergencyHistoryRoutes from './routes/emergencyHistory.js';
import db from './config/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.set('io', io);

app.use('/auth', authRoutes);
app.use('/trips', tripRoutes);
app.use('/sos', sosRoutes);
app.use('/directory', directoryRoutes);
app.use('/emergency-history', emergencyHistoryRoutes);

// Public tracking link — no auth
app.get('/track/:token', trackHandler);

app.get('/heatmap/danger-zones', async (req, res) => {
  const { data, error } = await db.from('danger_zones').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/heatmap/lighting', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'bangalore-lighting.json');
  if (!fs.existsSync(filePath)) {
    // Part 4's fetchLightingData.js hasn't been run yet — degrade gracefully
    // rather than 500ing the whole map screen.
    return res.status(404).json({ error: 'Lighting data not generated yet. Run utils/fetchLightingData.js.' });
  }
  res.sendFile(filePath);
});

app.get('/health', (_, res) => res.json({ ok: true }));

setupSocket(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`SafeGo backend running on port ${PORT}`));
