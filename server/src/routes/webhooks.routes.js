import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendWhatsAppToUser } from '../whatsapp/baileys.service.js';

const router = Router();

// n8n → Dashboard : réponse asynchrone d'un agent
router.post('/agent-reply', async (req, res, next) => {
  try {
    if (req.header('X-Dokatel-Secret') !== process.env.N8N_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Secret invalide' });
    }
    const { conversationId, reply } = req.body;
    const conv = await prisma.conversation.findUnique({ where: { id: Number(conversationId) } });
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    const msg = await prisma.message.create({
      data: { content: reply, role: 'AGENT', status: 'PENDING', conversationId: conv.id },
    });

    // Si la tâche a été démarrée depuis WhatsApp, on renvoie aussi la
    // réponse là-bas (l'employé n'a pas forcément l'app web ouverte).
    if (conv.channel === 'WHATSAPP') {
      await sendWhatsAppToUser(conv.userId, `${reply}\n\n_Réponds "oui" pour valider, ou précise ce qui doit changer._`);
    }

    res.json({ ok: true, messageId: msg.id });
  } catch (e) { next(e); }
});

export default router;