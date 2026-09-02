import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { askHermes } from '../services/hermes.service.js';

const router = Router();
router.use(requireAuth);

// Liste des conversations de l'utilisateur
router.get('/', async (req, res, next) => {
  try {
    const convs = await prisma.conversation.findMany({
      where: { userId: req.user.id },
      include: {
        agent: { include: { client: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(convs);
  } catch (e) { next(e); }
});

// Créer une conversation
router.post('/', async (req, res, next) => {
  try {
    const { agentId, title } = req.body;
    const conv = await prisma.conversation.create({
      data: { agentId: Number(agentId), userId: req.user.id, title: title || 'Nouvelle conversation' },
      include: { agent: { include: { client: true } } },
    });
    res.status(201).json(conv);
  } catch (e) { next(e); }
});

// Messages d'une conversation
router.get('/:id/messages', async (req, res, next) => {
  try {
    const msgs = await prisma.message.findMany({
      where: { conversationId: Number(req.params.id) },
      orderBy: { createdAt: 'asc' },
    });
    res.json(msgs);
  } catch (e) { next(e); }
});

// Envoyer un message → Hermes → réponse agent
router.post('/:id/messages', async (req, res, next) => {
  try {
    const convId = Number(req.params.id);
    const { content } = req.body;
    const conv = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { agent: true, messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });

    await prisma.message.create({
      data: { content, role: 'USER', conversationId: convId, userId: req.user.id },
    });

    const history = conv.messages.reverse().map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }));

    const { reply } = await askHermes({ agent: conv.agent, message: content, history });

    const agentMsg = await prisma.message.create({
      data: { content: reply, role: 'AGENT', conversationId: convId },
    });
    await prisma.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
    await prisma.agent.update({ where: { id: conv.agent.id }, data: { tasksCount: { increment: 1 } } });

    res.json(agentMsg);
  } catch (e) { next(e); }
});

// Valider / Réviser un message
router.patch('/messages/:messageId/status', async (req, res, next) => {
  try {
    const { status } = req.body; // VALIDATED | REVISED | PENDING
    const msg = await prisma.message.update({
      where: { id: Number(req.params.messageId) },
      data: { status },
    });
    res.json(msg);
  } catch (e) { next(e); }
});

export default router;