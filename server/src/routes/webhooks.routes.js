import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// n8n → Dashboard : réponse asynchrone d'un agent
router.post('/agent-reply', async (req, res, next) => {
  try {
    if (req.header('X-Dokatel-Secret') !== process.env.N8N_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Secret invalide' });
    }
    const { conversationId, reply } = req.body;
    const msg = await prisma.message.create({
      data: { content: reply, role: 'AGENT', conversationId: Number(conversationId) },
    });
    res.json({ ok: true, messageId: msg.id });
  } catch (e) { next(e); }
});

export default router;