# 🚀 Dokatel — Dashboard Agents Compagnons

Système d'agents IA compagnons pour agence marketing (Hermes + n8n).

## Stack
React + Tailwind / Node.js + Express / MySQL (Prisma) / Qdrant / WhatsApp (Baileys)

## Nouveautés

### Assignations employé ↔ agent
Chaque agent (ex: "Rédacteur · Client 1") peut être partagé par plusieurs employés,
et un employé peut avoir accès à plusieurs agents. Ça se gère via la table
`AgentAssignment` et les routes `/api/assignments` (CRUD) et `/api/users`
(gestion des employés, dont leur numéro WhatsApp).

Pour assigner un agent à un employé :
```bash
curl -X POST http://localhost:4000/api/assignments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"userId": 2, "agentId": 1}'
```

### Connecteur WhatsApp (Baileys, gratuit / non-officiel)
Un seul numéro WhatsApp partagé pour toute l'agence — le "grand chef" reçoit
tous les messages, identifie l'employé par son numéro, devine l'agent
concerné (rôle + client mentionnés) et route la demande.

**Mise en route** :
1. Chaque employé doit avoir un numéro renseigné (`phone` sur `User`, format
   E.164 sans le `+`, ex: `33612345678`) et au moins un agent assigné
   (`AgentAssignment`) — sinon il ne recevra qu'un message l'invitant à
   contacter un admin.
2. Passer `WHATSAPP_ENABLED=true` dans `server/.env`.
3. Démarrer le serveur (`npm run dev` dans `server/`) et scanner le QR code
   affiché dans le terminal avec WhatsApp → *Appareils liés*.
4. La session est sauvegardée dans `server/whatsapp-session/` (ignoré par
   git) — pas besoin de rescanner à chaque redémarrage.

**Usage employé** :
- En message privé au numéro de l'agence : `Rédige-moi un post pour le
  client Dupont` → le routeur devine le rôle (Rédaction) et le client
  (via `Client.keywords`), et active l'agent assigné correspondant.
- En groupe : préfixer le message avec `/agent` (configurable via
  `WHATSAPP_BOT_PREFIX`) pour ne pas répondre à toutes les conversations
  entre collègues.
- **Approbation** : une fois qu'un agent répond, l'employé répond simplement
  `oui` (valide) ou `non, <ce qu'il faut changer>` (l'agent reprend
  automatiquement avec cette instruction).
- Si un employé n'a qu'un seul agent assigné, il n'a pas besoin de préciser
  le rôle/client — il est utilisé par défaut.

**Sécurité** : un numéro WhatsApp inconnu (pas de `User.phone` correspondant)
ne peut déclencher aucune action — seul un message générique de refus est
renvoyé.

## Installation
