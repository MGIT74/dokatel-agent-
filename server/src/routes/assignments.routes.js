import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Liste des assignations, filtrable par employé ou par agent.
router.get('/', async (req, res, next) => {
  try {
    const { userId, agentId } = req.query;
    const where = {};
    if (userId) where.userId = Number(userId);
    if (agentId) where.agentId = Number(agentId);
    const assignments = await prisma.agentAssignment.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, phone: true } }, agent: { include: { client: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(assignments);
  } catch (e) { next(e); }
});

// Attribue un agent à un employé (ex: "Marie peut utiliser Rédacteur · Client 1").
router.post('/', async (req, res, next) => {
  try {
    const { userId, agentId } = req.body;
    if (!userId || !agentId) return res.status(400).json({ error: 'userId et agentId sont requis' });
    const assignment = await prisma.agentAssignment.upsert({
      where: { userId_agentId: { userId: Number(userId), agentId: Number(agentId) } },
      update: {},
      create: { userId: Number(userId), agentId: Number(agentId) },
      include: { user: { select: { id: true, name: true } }, agent: true },
    });
    res.status(201).json(assignment);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.agentAssignment.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
