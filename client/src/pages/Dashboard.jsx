import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { id: 'REDACTOR', label: 'Rédacteur', icon: 'fa-pen-nib' },
  { id: 'DESIGNER', label: 'Designer', icon: 'fa-palette' },
  { id: 'FUNNEL', label: 'Funnel', icon: 'fa-filter' },
  { id: 'DEVELOPER', label: 'Développeur', icon: 'fa-code' },
  { id: 'MEDIA_BUYER', label: 'Media Buyer', icon: 'fa-bullhorn' },
  { id: 'COMMERCIAL', label: 'Commercial', icon: 'fa-handshake' },
  { id: 'COMMUNITY', label: 'Community', icon: 'fa-hashtag' },
  { id: 'CUSTOM', label: 'Custom', icon: 'fa-wand-magic-sparkles' },
];

const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function useCount(target) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 900);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [convs, setConvs] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'CLIENT', role: 'REDACTOR', clientId: '', systemPrompt: '' });
  const msgsRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    api.get('/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/agents').then((r) => setAgents(r.data)).catch(() => {});
    api.get('/clients').then((r) => setClients(r.data)).catch(() => {});
    api.get('/conversations').then((r) => setConvs(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e) => setQ(e.detail || '');
    document.addEventListener('dokatel:search', h);
    return () => document.removeEventListener('dokatel:search', h);
  }, []);

  useEffect(() => { msgsRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [messages, typing]);

  const filtered = agents.filter(
    (a) => (filter === 'all' || a.type.toLowerCase() === filter) && (!q || a.name.toLowerCase().includes(q.toLowerCase()))
  );
  const online = agents.filter((a) => a.status === 'ONLINE').length;

  const openConv = async (c) => {
    setActiveConv(c);
    const { data } = await api.get(`/conversations/${c.id}/messages`);
    setMessages(data);
  };

  const startConvWith = async (agent) => {
    let conv = convs.find((c) => c.agentId === agent.id);
    if (!conv) {
      const { data } = await api.post('/conversations', { agentId: agent.id });
      conv = { ...data, agent, messages: [] };
      setConvs((cs) => [conv, ...cs]);
    }
    openConv(conv);
    document.getElementById('chatAnchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const send = async (quick) => {
    const content = (quick ?? input).trim();
    if (!content) return;
    let conv = activeConv;
    if (!conv) {
      if (!filtered[0]) return showToast('⚠️ Créez d\'abord un agent');
      const { data } = await api.post('/conversations', { agentId: filtered[0].id, title: content.slice(0, 40) });
      conv = { ...data, agent: filtered[0], messages: [] };
      setActiveConv(conv);
      setConvs((cs) => [conv, ...cs]);
    }
    setInput('');
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'USER', content, status: 'PENDING', createdAt: new Date().toISOString() }]);
    setTyping(true);
    try {
      const { data } = await api.post(`/conversations/${conv.id}/messages`, { content });
      setMessages((m) => [...m, data]);
    } catch {
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'AGENT', status: 'PENDING', content: '⚠️ Impossible de joindre Hermes. Vérifiez que le serveur tourne et que HERMES_WEBHOOK_URL est configurée.' }]);
    } finally {
      setTyping(false);
    }
  };

  const validate = async (m, status) => {
    const { data } = await api.patch(`/conversations/messages/${m.id}/status`, { status });
    setMessages((ms) => ms.map((x) => (x.id === m.id ? data : x)));
    showToast(status === 'VALIDATED' ? '✅ Contenu validé !' : '🔄 Révision demandée');
  };

  const submitAgent = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/agents', form);
      setAgents((a) => [...a, data]);
      setShowModal(false);
      setForm({ name: '', type: 'CLIENT', role: 'REDACTOR', clientId: '', systemPrompt: '' });
      showToast('🎉 Agent déployé ! Hermes le configure…');
    } catch {
      showToast('❌ Erreur lors de la création');
    }
  };

  const deleteAgent = async (a) => {
    if (!confirm(`Supprimer ${a.name} ?`)) return;
    await api.delete(`/agents/${a.id}`);
    setAgents((as) => as.filter((x) => x.id !== a.id));
    showToast('🗑️ Agent supprimé');
  };

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <div>
          <h1>Bonjour {user?.name || 'Ahmed'} 👋<br />Vos <em>agents compagnons</em> sont prêts.</h1>
          <p><b>{online} agents actifs</b><span className="sep">·</span>{agents.length} au total<span className="sep">·</span><span className="ok">Système opérationnel ✅</span></p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-ghost" onClick={() => showToast('📊 Les rapports arrivent en v2 !')}><i className="fas fa-arrow-up-right-dots"></i> Rapports</button>
          <button className="btn btn-accent" onClick={() => setShowModal(true)}><i className="fas fa-plus"></i> Créer un agent</button>
        </div>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="stat">
          <div className="stat-top">
            <div className="stat-ico v"><i className="fas fa-robot"></i></div>
          </div>
          <div className="stat-value">{Math.round(useCount(stats?.agentsActive))}</div>
          <div className="stat-label">Agents actifs</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <div className="stat-ico c"><i className="fas fa-paper-plane"></i></div>
          </div>
          <div className="stat-value">{Math.round(useCount(stats?.messagesToday))}</div>
          <div className="stat-label">Messages aujourd'hui</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <div className="stat-ico g"><i className="fas fa-circle-check"></i></div>
          </div>
          <div className="stat-value">{Math.round(useCount(stats?.validationRate))}%</div>
          <div className="stat-label">Taux de validation</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <div className="stat-ico l"><i className="fas fa-bolt"></i></div>
          </div>
          <div className="stat-value">{useCount(stats?.avgResponseTime).toFixed(1)}s</div>
          <div className="stat-label">Temps de réponse moyen</div>
        </div>
      </div>

      {/* AGENTS */}
      <div className="section">
        <div className="section-head">
          <h2 className="section-title"><i className="fas fa-robot"></i> Agents Compagnons <span className="count">{filtered.length} affichés</span></h2>
          <div className="chips-row">
            <button className={`chip-f ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Tous</button>
            <button className={`chip-f ${filter === 'client' ? 'active' : ''}`} onClick={() => setFilter('client')}>🏢 Clients</button>
            <button className={`chip-f ${filter === 'internal' ? 'active' : ''}`} onClick={() => setFilter('internal')}>🏠 Internes</button>
            <input className="mini-search" placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="agents">
          {filtered.map((a) => (
            <div key={a.id} className={`agent ${a.status.toLowerCase()}`}>
              <div className="agent-top">
                <div className={`agent-ava ${a.colorClass}`}><i className={`fas fa-${a.icon}`}></i></div>
                <div className="agent-id">
                  <h3>{a.name}</h3>
                  {a.type === 'CLIENT'
                    ? <span className="tag client"><i className="fas fa-building"></i> {a.client?.name || 'Sans client'}</span>
                    : <span className="tag internal"><i className="fas fa-house"></i> Dokatel</span>}
                </div>
                <span className={`status ${a.status === 'ONLINE' ? 'on' : a.status === 'BUSY' ? 'busy' : 'off'}`}>● {a.status === 'ONLINE' ? 'En ligne' : a.status === 'BUSY' ? 'Occupé' : 'Hors ligne'}</span>
              </div>

              <div className="agent-metrics">
                <div className="metric"><b>{a.tasksCount}</b><span>Tâches</span></div>
                <div className="metric"><b>{Math.round(a.quality)}%</b><span>Qualité</span></div>
                <div className="metric"><b>{Math.round(a.hoursSaved)}h</b><span>Économisé</span></div>
              </div>

              <div className="progress-head"><span>{a.type === 'CLIENT' ? 'Objectif hebdo' : 'Charge'}</span><b>{Math.round(a.weeklyGoal)}%</b></div>
              <div className="bar"><i style={{ width: `${a.weeklyGoal}%` }}></i></div>

              <div className="agent-actions">
                <button className="a-chat" onClick={() => startConvWith(a)}><i className="fas fa-comment-dots"></i> Discuter</button>
                <button className="a-cfg" title="Supprimer" onClick={() => deleteAgent(a)}><i className="fas fa-trash"></i></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <div className="section chat-section" id="chatAnchor">
        <div className="chat-grid">
          <div className="chat-list">
            <h4><i className="fas fa-inbox"></i> Conversations</h4>
            {convs.length === 0 && (
              <p style={{ padding: '10px', fontSize: 12, color: 'var(--text-faint)' }}>Aucune conversation. Cliquez sur « Discuter » !</p>
            )}
            {convs.map((c) => {
              const ag = agents.find((x) => x.id === c.agentId) || c.agent;
              return (
                <div key={c.id} className={`conv ${activeConv?.id === c.id ? 'active' : ''}`} onClick={() => openConv(c)}>
                  <div className={`conv-ava ${ag?.colorClass || 'g-blue'}`}>
                    <i className={`fas fa-${ag?.icon || 'robot'}`}></i>
                    <span className={`sd ${ag?.status === 'ONLINE' ? 'sd-on' : 'sd-off'}`}></span>
                  </div>
                  <div className="conv-info">
                    <b>{ag?.name}</b>
                    <p>{c.messages?.[0]?.content?.slice(0, 42) || c.title}</p>
                  </div>
                  <div className="conv-meta"><span>{fmtTime(c.updatedAt)}</span></div>
                </div>
              );
            })}
          </div>

          <div className="chat-main">
            <div className="chat-head">
              <div className={`conv-ava ${agents.find((x) => x.id === activeConv?.agentId)?.colorClass || 'g-red'}`} style={{ width: 44, height: 44 }}>
                <i className={`fas fa-${agents.find((x) => x.id === activeConv?.agentId)?.icon || 'robot'}`}></i>
              </div>
              <div className="info">
                <b>{agents.find((x) => x.id === activeConv?.agentId)?.name || 'Sélectionnez un agent'}</b>
                <span><i className="fas fa-circle" style={{ fontSize: 6 }}></i> {activeConv ? 'Connecté' : '—'}</span>
              </div>
              <div className="tools">
                <button title="WhatsApp"><i className="fab fa-whatsapp"></i></button>
              </div>
            </div>

            <div className="msgs" ref={msgsRef}>
              {messages.length === 0 && <div className="date-sep">Commencez la conversation 👇</div>}
              {messages.map((m) => {
                const ag = agents.find((x) => x.id === activeConv?.agentId);
                return (
                  <div key={m.id} className={`msg ${m.role === 'USER' ? 'user' : 'bot'}`}>
                    {m.role === 'USER'
                      ? <div className="msg-ava">{user?.name?.[0] || 'A'}</div>
                      : <div className={`msg-ava ${ag?.colorClass || 'g-red'}`}><i className={`fas fa-${ag?.icon || 'robot'}`}></i></div>}
                    <div>
                      <div className="bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      <div className="msg-meta">
                        <span>{fmtTime(m.createdAt)}</span>
                        {m.role === 'AGENT' && (
                          <>
                            <span className="lk" onClick={() => navigator.clipboard?.writeText(m.content)}><i className="fas fa-copy"></i> Copier</span>
                            <span className="lk ok" onClick={() => validate(m, 'VALIDATED')}><i className="fas fa-check"></i> {m.status === 'VALIDATED' ? 'Validé ✓' : 'Valider'}</span>
                            <span className="lk" onClick={() => validate(m, 'REVISED')}><i className="fas fa-rotate"></i> Réviser</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {typing && (
                <div className="msg bot">
                  <div className={`msg-ava ${agents.find((x) => x.id === activeConv?.agentId)?.colorClass || 'g-red'}`}><i className={`fas fa-${agents.find((x) => x.id === activeConv?.agentId)?.icon || 'robot'}`}></i></div>
                  <div><div className="bubble"><div className="typing"><i></i><i></i><i></i></div></div></div>
                </div>
              )}
            </div>

            <div className="chat-input">
              <div className="chips">
                <button className="chip" onClick={() => send('✍️ Rédige un post Instagram sur notre nouvelle offre')}>✍️ Post Instagram</button>
                <button className="chip" onClick={() => send('📊 Génère le rapport hebdo de la campagne')}>📊 Rapport hebdo</button>
                <button className="chip" onClick={() => send('🎨 Propose 3 idées de visuels pour la story')}>🎨 Idées visuels</button>
              </div>
              <div className="input-row">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Écrivez à votre agent…" />
                <button className="send-btn" onClick={() => send()}><i className="fas fa-paper-plane"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CRÉATION */}
      <div className={`overlay ${showModal ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
        <div className="modal">
          <div className="modal-head">
            <div>
              <h2>Créer un nouvel agent 🤖</h2>
              <p>Déployé via Hermes · synchronisé avec n8n automatiquement</p>
            </div>
            <button className="x-btn" onClick={() => setShowModal(false)}><i className="fas fa-xmark"></i></button>
          </div>

          <form onSubmit={submitAgent}>
            <div className="field">
              <label>Nom de l'agent</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Rédacteur · Client 4" required />
            </div>

            <div className="field">
              <label>Type d'agent</label>
              <div className="segmented">
                <button type="button" className={`seg ${form.type === 'CLIENT' ? 'active' : ''}`} onClick={() => setForm({ ...form, type: 'CLIENT' })}>🏢 Agent Client</button>
                <button type="button" className={`seg ${form.type === 'INTERNAL' ? 'active' : ''}`} onClick={() => setForm({ ...form, type: 'INTERNAL' })}>🏠 Agent Interne</button>
              </div>
            </div>

            <div className="field">
              <label>Rôle / Métier</label>
              <div className="role-grid">
                {ROLES.map((r) => (
                  <div key={r.id} className={`role ${form.role === r.id ? 'selected' : ''}`} onClick={() => setForm({ ...form, role: r.id })}>
                    <i className={`fas ${r.icon}`}></i><span>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {form.type === 'CLIENT' && (
              <div className="field">
                <label>Client associé</label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                  <option value="">— Sélectionner —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Instructions (prompt système)</label>
              <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} placeholder="Ex : Tu es un rédacteur senior spécialisé en ton professionnel et engageant…"></textarea>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-accent"><i className="fas fa-rocket"></i> Déployer l'agent</button>
            </div>
          </form>
        </div>
      </div>

      {/* TOAST */}
      <div className={`toast ${toast ? 'show' : ''}`}><i className="fas fa-circle-check"></i><span>{toast}</span></div>
    </>
  );
}