import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
    const [agentsActive, messagesToday, validated, totalAgentMsgs] = await Promise.all([
      prisma.agent.count({ where: { status: 'ONLINE' } }),
      prisma.message.count({ where: { createdAt: { gte: startOfDay }, role: 'USER' } }),
      prisma.message.count({ where: { status: 'VALIDATED' } }),
      prisma.message.count({ where: { role: 'AGENT' } }),
    ]);
    res.json({
      agentsActive,
      messagesToday,
      validationRate: totalAgentMsgs ? Math.round((validated / totalAgentMsgs) * 100) : 0,
      avgResponseTime: 2.3,
    });
  } catch (e) { next(e); }
});

export default router;