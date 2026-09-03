import { prisma } from '../lib/prisma.js';

// Mots-clés par rôle utilisés pour deviner de quel métier parle un message
// WhatsApp libre. Volontairement simple (pas de LLM ici) : le vrai routage
// sémantique fin peut être délégué à Hermes plus tard si besoin.
const ROLE_KEYWORDS = {
  REDACTOR: ['rédig', 'redig', 'écri', 'ecri', 'post', 'article', 'copywriting', 'texte'],
  DESIGNER: ['design', 'visuel', 'maquette', 'logo', 'image', 'bannière', 'banniere'],
  FUNNEL: ['funnel', 'landing', 'tunnel de vente', 'page de vente'],
  DEVELOPER: ['bug', 'site web', 'développe', 'developpe', 'code', 'intégration', 'integration'],
  MEDIA_BUYER: ['campagne', 'ads', 'budget pub', 'media buying', 'facebook ads', 'google ads'],
  COMMERCIAL: ['devis', 'prospection', 'relance client', 'facture', 'contrat'],
  COMMUNITY: ['commentaire', 'community', 'réseaux sociaux', 'reseaux sociaux', 'dm', 'story'],
};

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // enlève les accents pour un matching robuste
}

/**
 * Devine le rôle métier concerné par un message libre, en se basant sur des
 * mots-clés. Retourne null si aucun rôle ne matche clairement.
 */
export function guessRole(message) {
  const text = normalize(message);
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some((k) => text.includes(normalize(k)))) return role;
  }
  return null;
}

/**
 * Cherche si un client connu est nommé dans le message, via son nom ou ses
 * mots-clés déclarés (Client.keywords, séparés par des virgules).
 */
export async function guessClient(message) {
  const text = normalize(message);
  const clients = await prisma.client.findMany();
  for (const client of clients) {
    const candidates = [client.name, ...(client.keywords ? client.keywords.split(',') : [])];
    if (candidates.some((c) => c && text.includes(normalize(c)))) return client;
  }
  return null;
}

/**
 * Trouve le meilleur agent à activer pour un employé donné et un message
 * libre (typiquement reçu par WhatsApp).
 *
 * Logique :
 * 1. Devine le rôle et le client mentionnés dans le message.
 * 2. Restreint aux agents que cet employé a le droit d'utiliser
 *    (AgentAssignment) — sécurité : jamais d'accès à un agent non assigné.
 * 3. Affine par rôle/client si plusieurs agents assignés correspondent.
 * 4. Si un seul agent assigné existe au total, on l'utilise par défaut
 *    (cas simple : l'employé n'a qu'un seul agent).
 *
 * Retourne { agent, ambiguous, candidates } — si `ambiguous` est vrai,
 * `candidates` contient les agents entre lesquels il faut trancher (on
 * demande alors à l'employé de préciser plutôt que de deviner au hasard).
 */
export async function routeToAgent({ user, message }) {
  const assignments = await prisma.agentAssignment.findMany({
    where: { userId: user.id },
    include: { agent: { include: { client: true } } },
  });
  const assignedAgents = assignments.map((a) => a.agent);

  if (assignedAgents.length === 0) {
    return { agent: null, ambiguous: false, candidates: [], reason: 'no_assignment' };
  }
  if (assignedAgents.length === 1) {
    return { agent: assignedAgents[0], ambiguous: false, candidates: assignedAgents };
  }

  const role = guessRole(message);
  const client = await guessClient(message);

  let candidates = assignedAgents;
  if (role) candidates = candidates.filter((a) => a.role === role);
  if (client) candidates = candidates.filter((a) => a.clientId === client.id);

  // Si le filtrage rôle+client a trop réduit (0 résultat), on relâche le
  // filtre client puis le filtre rôle plutôt que de renvoyer une liste vide.
  if (candidates.length === 0 && role) {
    candidates = assignedAgents.filter((a) => a.role === role);
  }
  if (candidates.length === 0) {
    candidates = assignedAgents;
  }

  if (candidates.length === 1) {
    return { agent: candidates[0], ambiguous: false, candidates };
  }

  return { agent: null, ambiguous: true, candidates };
}
