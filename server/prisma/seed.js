import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const AGENTS = [
  { name: 'Rédacteur · Client 1', type: 'CLIENT', role: 'REDACTOR', client: 'Startup Tech', status: 'ONLINE', tasksCount: 24, quality: 98, hoursSaved: 2, weeklyGoal: 80, systemPrompt: 'Tu es un rédacteur senior. Ton professionnel et engageant. Tu écris pour LinkedIn, Instagram et les blogs.' },
  { name: 'Designer · Client 1', type: 'CLIENT', role: 'DESIGNER', client: 'Startup Tech', status: 'ONLINE', tasksCount: 18, quality: 95, hoursSaved: 3, weeklyGoal: 65, systemPrompt: 'Tu es un directeur artistique. Tu crées des briefs visuels détaillés et des concepts créatifs.' },
  { name: 'Commercial · Client 1', type: 'CLIENT', role: 'COMMERCIAL', client: 'E-commerce Pro', status: 'BUSY', tasksCount: 31, quality: 92, hoursSaved: 4, weeklyGoal: 90, systemPrompt: 'Tu es un commercial B2B. Tu rédiges des devis, relances et emails de prospection percutants.' },
  { name: 'Funnel · Client 2', type: 'CLIENT', role: 'FUNNEL', client: 'Restaurant Gourmet', status: 'ONLINE', tasksCount: 12, quality: 96, hoursSaved: 5, weeklyGoal: 45, systemPrompt: 'Tu es un expert funnel. Tu conçois des landing pages et séquences emails qui convertissent.' },
  { name: 'Media Buyer · Client 3', type: 'CLIENT', role: 'MEDIA_BUYER', client: 'FitLife App', status: 'BUSY', tasksCount: 27, quality: 94, hoursSaved: 6, weeklyGoal: 72, systemPrompt: 'Tu es un media buyer senior. Tu analyses les campagnes Meta/Google et proposes des optimisations.' },
  { name: 'Rédacteur · Client 2', type: 'CLIENT', role: 'REDACTOR', client: 'Restaurant Gourmet', status: 'ONLINE', tasksCount: 15, quality: 97, hoursSaved: 2, weeklyGoal: 58, systemPrompt: 'Tu es un rédacteur spécialisé food & restauration. Ton chaleureux et gourmand.' },
  { name: 'Designer · Interne', type: 'INTERNAL', role: 'DESIGNER', client: null, status: 'ONLINE', tasksCount: 56, quality: 97, hoursSaved: 8, weeklyGoal: 85, systemPrompt: 'Tu es le designer interne de Dokatel. Tu produis maquettes et identités visuelles internes.' },
  { name: 'Rédacteur · Interne', type: 'INTERNAL', role: 'REDACTOR', client: null, status: 'ONLINE', tasksCount: 42, quality: 96, hoursSaved: 6, weeklyGoal: 60, systemPrompt: 'Tu es le rédacteur interne de Dokatel. Newsletters, docs internes, posts corporate.' },
  { name: 'Community · Interne', type: 'INTERNAL', role: 'COMMUNITY', client: null, status: 'OFFLINE', tasksCount: 15, quality: 94, hoursSaved: 2, weeklyGoal: 25, systemPrompt: 'Tu gères les réseaux sociaux de Dokatel : calendrier éditorial, réponses, veille.' },
];

async function main() {
  console.log('🌱 Seed démarré…');

  const password = await bcrypt.hash('dokatel2026', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dokatel.com' },
    update: {},
    create: { email: 'admin@dokatel.com', password, name: 'Ahmed', role: 'ADMIN' },
  });

  const clientMap = {};
  for (const name of ['Startup Tech', 'E-commerce Pro', 'Restaurant Gourmet', 'FitLife App']) {
    let c = await prisma.client.findFirst({ where: { name } });
    if (!c) c = await prisma.client.create({ data: { name } });
    clientMap[name] = c.id;
  }

  for (const a of AGENTS) {
    const exists = await prisma.agent.findFirst({ where: { name: a.name } });
    if (!exists) {
      await prisma.agent.create({
        data: {
          name: a.name, type: a.type, role: a.role, status: a.status,
          systemPrompt: a.systemPrompt, tasksCount: a.tasksCount, quality: a.quality,
          hoursSaved: a.hoursSaved, weeklyGoal: a.weeklyGoal,
          clientId: a.client ? clientMap[a.client] : null,
          createdById: admin.id,
        },
      });
    }
  }

  // Conversation démo
  const redactor = await prisma.agent.findFirst({ where: { name: 'Rédacteur · Client 1' } });
  let conv = await prisma.conversation.findFirst({ where: { userId: admin.id, agentId: redactor.id } });
  if (!conv) {
    conv = await prisma.conversation.create({ data: { agentId: redactor.id, userId: admin.id, title: 'Post LinkedIn IA' } });
    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, userId: admin.id, role: 'USER', content: "Crée un post LinkedIn sur l'impact de l'IA dans le marketing digital. Ton professionnel mais engageant 👌" },
        { conversationId: conv.id, role: 'AGENT', content: "Voici votre post 🚀\n\nL'IA transforme le marketing digital\n\n📊 +40% de ROI pour les entreprises qui l'adoptent\n💡 L'IA ne remplace pas la créativité, elle l'amplifie\n\nTrouvez l'équilibre entre automatisation et touche humaine 🎯\n\n#MarketingDigital #IA #Innovation" },
      ],
    });
  }

  console.log('✅ Seed terminé ! Connexion : admin@dokatel.com / dokatel2026');
}

main().catch(console.error).finally(() => prisma.$disconnect());