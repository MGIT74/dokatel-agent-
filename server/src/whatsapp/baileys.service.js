import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { prisma } from '../lib/prisma.js';
import { askHermes } from '../services/hermes.service.js';
import { routeToAgent } from '../services/router.service.js';

const SESSION_DIR = process.env.WHATSAPP_SESSION_DIR || './whatsapp-session';
const ALLOW_GROUPS = (process.env.WHATSAPP_ALLOW_GROUPS || 'true') === 'true';
const BOT_PREFIX = (process.env.WHATSAPP_BOT_PREFIX || '/agent').toLowerCase();

const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' });

// Regex simples pour l'approbation en langage naturel (FR).
const APPROVE_RE = /^(oui|ok(ay)?|okay|valide|validé|valid[eé]e?|go|parfait|nickel|c'est bon|impec|👍)\b/i;
const REJECT_RE = /^(non|refuse|annule|stop|change|modifie|reprends|revoi[rs])\b/i;

let sock = null;

/** Normalise un JID WhatsApp ("336xxxxxxxx@s.whatsapp.net") en numéro brut ("336xxxxxxxx"). */
function jidToPhone(jid = '') {
  return jid.split('@')[0].split(':')[0];
}

function extractText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function isGroupJid(jid = '') {
  return jid.endsWith('@g.us');
}

/** Récupère le dernier message AGENT en attente de validation pour cet employé, tous canaux WhatsApp confondus. */
async function findPendingApproval(userId) {
  return prisma.message.findFirst({
    where: {
      role: 'AGENT',
      status: 'PENDING',
      conversation: { userId, channel: 'WHATSAPP' },
    },
    orderBy: { createdAt: 'desc' },
    include: { conversation: { include: { agent: true } } },
  });
}

/** Trouve ou crée la conversation WhatsApp active entre cet employé et cet agent. */
async function getOrCreateConversation(userId, agentId) {
  let conv = await prisma.conversation.findFirst({
    where: { userId, agentId, channel: 'WHATSAPP' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: { userId, agentId, channel: 'WHATSAPP', title: 'WhatsApp' },
    });
  }
  return conv;
}

async function replyTo(jid, text) {
  if (!sock) return;
  try {
    await sock.sendMessage(jid, { text });
  } catch (err) {
    console.error('Erreur envoi WhatsApp', err);
  }
}

async function handleApproval(jid, user, text, pending) {
  const extra = text.replace(REJECT_RE, '').trim();

  if (APPROVE_RE.test(text)) {
    await prisma.message.update({ where: { id: pending.id }, data: { status: 'VALIDATED' } });
    await replyTo(jid, `✅ Validé — "${pending.conversation.agent.name}" note que c'est bon.`);
    return;
  }

  if (REJECT_RE.test(text)) {
    await prisma.message.update({ where: { id: pending.id }, data: { status: 'REJECTED' } });

    // Si l'employé a précisé ce qu'il veut changer, on relance directement
    // l'agent avec cette instruction plutôt que de s'arrêter là.
    if (extra) {
      await replyTo(jid, `🔄 Compris, je fais reprendre "${pending.conversation.agent.name}"…`);
      await runAgentTask({ jid, user, agentId: pending.conversation.agentId, conversationId: pending.conversation.id, message: extra });
    } else {
      await replyTo(jid, `❌ Ok, mis de côté. Dis-moi ce que tu veux changer si tu veux que je reprenne.`);
    }
    return;
  }
}

/** Envoie un message à Hermes pour un agent donné, sauvegarde le résultat, et répond sur WhatsApp. */
async function runAgentTask({ jid, user, agentId, conversationId, message }) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { agent: true, messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  await prisma.message.create({
    data: { content: message, role: 'USER', conversationId, userId: user.id },
  });

  const history = conv.messages.reverse().map((m) => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
  }));

  let reply;
  try {
    ({ reply } = await askHermes({ agent: conv.agent, message, history }));
  } catch (err) {
    console.error('Erreur Hermes', err);
    await replyTo(jid, "⚠️ L'agent rencontre un souci pour répondre, réessaie dans un instant.");
    return;
  }

  await prisma.message.create({
    data: { content: reply, role: 'AGENT', status: 'PENDING', conversationId },
  });
  await prisma.agent.update({ where: { id: agentId }, data: { tasksCount: { increment: 1 } } });

  await replyTo(jid, `${reply}\n\n_Réponds "oui" pour valider, ou précise ce qui doit changer._`);
}

async function onIncomingMessage(msg) {
  if (!msg.message || msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  const group = isGroupJid(remoteJid);
  let text = extractText(msg);
  if (!text) return;

  // En groupe, on n'intervient que si le préfixe est utilisé, pour ne pas
  // répondre à toutes les conversations entre collègues.
  if (group) {
    if (!text.toLowerCase().startsWith(BOT_PREFIX)) return;
    if (!ALLOW_GROUPS) return;
    text = text.slice(BOT_PREFIX.length).trim();
  }

  const senderJid = group ? msg.key.participant : remoteJid;
  const phone = jidToPhone(senderJid);

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    await replyTo(remoteJid, "Ce numéro n'est pas reconnu comme employé. Contacte un admin pour être ajouté.");
    return;
  }

  // 1) Y a-t-il une tâche en attente d'approbation pour cet employé ?
  const pending = await findPendingApproval(user.id);
  if (pending && (APPROVE_RE.test(text) || REJECT_RE.test(text))) {
    await handleApproval(remoteJid, user, text, pending);
    return;
  }

  // 2) Sinon, nouvelle demande — on route vers le bon agent.
  const { agent, ambiguous, candidates, reason } = await routeToAgent({ user, message: text });

  if (reason === 'no_assignment') {
    await replyTo(remoteJid, "Tu n'as pas encore d'agent assigné. Demande à un admin de t'en attribuer un.");
    return;
  }

  if (ambiguous) {
    const options = candidates.map((a) => `• ${a.name}`).join('\n');
    await replyTo(remoteJid, `Je ne sais pas trop quel agent utiliser, précise lequel :\n${options}`);
    return;
  }

  const conv = await getOrCreateConversation(user.id, agent.id);
  await runAgentTask({ jid: remoteJid, user, agentId: agent.id, conversationId: conv.id, message: text });
}

export async function initWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('📱 Scanne ce QR code avec WhatsApp (Appareils liés) :');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('WhatsApp déconnecté', { statusCode, shouldReconnect });
      if (shouldReconnect) initWhatsApp();
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connecté');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        await onIncomingMessage(msg);
      } catch (err) {
        console.error('Erreur traitement message WhatsApp', err);
      }
    }
  });

  return sock;
}

/** Permet à d'autres parties de l'app (ex: webhook n8n) d'envoyer un message WhatsApp à un employé via son téléphone. */
export async function sendWhatsAppToUser(userId, text) {
  if (!sock) return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.phone) return false;
  await replyTo(`${user.phone}@s.whatsapp.net`, text);
  return true;
}
