import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ICONS = {
  REDACTOR: 'pen-nib', DESIGNER: 'palette', FUNNEL: 'filter', DEVELOPER: 'code',
  MEDIA_BUYER: 'bullhorn', COMMERCIAL: 'handshake', COMMUNITY: 'hashtag', CUSTOM: 'wand-magic-sparkles',
};
const COLORS = {
  REDACTOR: 'g-red', DESIGNER: 'g-blue', FUNNEL: 'g-amber', DEVELOPER: 'g-purple',
  MEDIA_BUYER: 'g-cyan', COMMERCIAL: 'g-green', COMMUNITY: 'g-green', CUSTOM: 'g-purple',
};

const decorate = (a) => ({ ...a, icon: ICONS[a.role] || 'robot', colorClass: COLORS[a.role] || 'g-blue' });

router.get('/', async (req, res, next) => {
  try {
    const { type, q } = req.query;
    const where = {};
    if (type && type !== 'all') where.type = type.toUpperCase();
    if (q) where.name = { contains: q };
    const agents = await prisma.agent.findMany({ where, include: { client: true }, orderBy: { createdAt: 'asc' } });
    res.json(agents.map(decorate));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, type, role, clientId, systemPrompt } = req.body;
    const agent = await prisma.agent.create({
      data: {
        name,
        type: (type || 'CLIENT').toUpperCase(),
        role: (role || 'CUSTOM').toUpperCase(),
        systemPrompt: systemPrompt || `Tu es ${name}, un agent compagnon expert en ${role}.`,
        clientId: clientId ? Number(clientId) : null,
        createdById: req.user.id,
        status: 'ONLINE',
      },
      include: { client: true },
    });
    res.status(201).json(decorate(agent));
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name, systemPrompt, status } = req.body;
    const agent = await prisma.agent.update({
      where: { id: Number(req.params.id) },
      data: { ...(name && { name }), ...(systemPrompt && { systemPrompt }), ...(status && { status }) },
      include: { client: true },
    });
    res.json(decorate(agent));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.agent.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;