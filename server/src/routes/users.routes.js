import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SAFE_FIELDS = { id: true, email: true, name: true, role: true, phone: true, createdAt: true };

router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: SAFE_FIELDS, orderBy: { createdAt: 'asc' } });
    res.json(users);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { email, password, name, role, phone } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password et name sont requis' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: (role || 'EMPLOYEE').toUpperCase(), phone: phone || null },
      select: SAFE_FIELDS,
    });
    res.status(201).json(user);
  } catch (e) { next(e); }
});

// Utilisé notamment pour associer/mettre à jour le numéro WhatsApp d'un employé.
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, role, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { ...(name && { name }), ...(role && { role: role.toUpperCase() }), ...(phone !== undefined && { phone: phone || null }) },
      select: SAFE_FIELDS,
    });
    res.json(user);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
