import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@dokatel.com');
  const [password, setPassword] = useState('dokatel2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); return null; }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay show" style={{ position: 'fixed' }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="logo-mark" style={{ width: 46, height: 46 }}><i className="fas fa-robot"></i></div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.6px' }}>Doka<em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>~tel</em></h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>Votre escadron d'agents IA</p>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 14 }}>⚠️ {error}</p>}

          <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center', padding: 14 }} disabled={loading}>
            {loading ? 'Connexion…' : <>Se connecter <i className="fas fa-arrow-right"></i></>}
          </button>
        </form>
      </div>
    </div>
  );
}