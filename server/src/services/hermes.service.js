const HERMES_WEBHOOK_URL = process.env.HERMES_WEBHOOK_URL || '';

export async function askHermes({ agent, message, history }) {
  // Mode démo : pas d'URL configurée → réponse simulée
  if (!HERMES_WEBHOOK_URL) {
    return {
      reply: `Bien reçu ! 🚀\n\nJ'ai bien noté votre demande : « ${message} »\nJe travaille dessus et je reviens vers vous avec une première proposition.\n\n(ℹ️ Mode démo — connectez n8n via HERMES_WEBHOOK_URL pour des réponses réelles.)`,
      meta: { demo: true },
    };
  }

  const res = await fetch(HERMES_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dokatel-Secret': process.env.N8N_WEBHOOK_SECRET || '',
    },
    body: JSON.stringify({
      agent: { name: agent.name, role: agent.role, type: agent.type, systemPrompt: agent.systemPrompt },
      message,
      history,
    }),
  });

  if (!res.ok) throw new Error(`Hermes a répondu ${res.status}`);
  const data = await res.json();
  const reply = data.reply ?? data.output ?? data.text ?? JSON.stringify(data);
  return { reply, meta: data };
}