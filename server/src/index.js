import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import agentRoutes from './routes/agents.routes.js';
import conversationRoutes from './routes/conversations.routes.js';
import clientRoutes from './routes/clients.routes.js';
import statsRoutes from './routes/stats.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import userRoutes from './routes/users.routes.js';
import assignmentRoutes from './routes/assignments.routes.js';
import { initWhatsApp } from './whatsapp/baileys.service.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'dokatel-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assignments', assignmentRoutes);

app.use(errorHandler);

app.listen(PORT, () => console.log(`🚀 Dokatel API : http://localhost:${PORT}`));

// Le connecteur WhatsApp est optionnel — activez-le via WHATSAPP_ENABLED=true
// une fois les employés et leurs assignations créés en base.
if (process.env.WHATSAPP_ENABLED === 'true') {
  initWhatsApp().catch((err) => console.error('Erreur démarrage WhatsApp', err));
} else {
  console.log('ℹ️  Connecteur WhatsApp désactivé (WHATSAPP_ENABLED=false)');
}