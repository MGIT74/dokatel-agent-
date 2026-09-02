import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    res.json(await prisma.client.findMany({ include: { agents: true }, orderBy: { createdAt: 'asc' } }));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, company, email } = req.body;
    res.status(201).json(await prisma.client.create({ data: { name, company, email } }));
  } catch (e) { next(e); }
});

export default router;