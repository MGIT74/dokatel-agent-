import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('dokatel_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dokatel_theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('globalSearch')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const onSearch = (e) => {
    document.dispatchEvent(new CustomEvent('dokatel:search', { detail: e.target.value }));
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark"><i className="fas fa-robot"></i></div>
          <div className="logo-name">Doka<em>~tel</em></div>
        </div>

        <div className="nav-label">Principal</div>
        <ul className="nav">
          <li><a href="#" className="active"><i className="fas fa-house"></i><span>Dashboard</span></a></li>
          <li><a href="#"><i className="fas fa-comments"></i><span>Messagerie</span></a></li>
          <li><a href="#"><i className="fas fa-robot"></i><span>Agents</span></a></li>
          <li><a href="#"><i className="fas fa-folder-open"></i><span>Clients</span></a></li>
        </ul>

        <div className="user-card">
          <div className="user-row">
            <div className="pic">{user?.name?.[0] || 'A'}</div>
            <div className="user-info">
              <b>{user?.name}</b>
              <span>{user?.email}</span>
            </div>
            <span className="plan-chip">{user?.role || 'ADMIN'}</span>
          </div>
          <button className="upgrade-btn" onClick={logout}>
            <i className="fas fa-right-from-bracket"></i> Déconnexion
          </button>
        </div>

        <div className="theme-toggle">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><i className="fas fa-sun"></i> Light</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><i className="fas fa-moon"></i> Dark</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search">
            <i className="fas fa-magnifying-glass mag"></i>
            <input id="globalSearch" type="text" placeholder="Rechercher un agent, un client, une tâche…" onInput={onSearch} />
            <span className="kbd">⌘ F</span>
          </div>
          <div className="topbar-right">
            <button className="icon-btn"><i className="fas fa-bell"></i><span className="dot"></span></button>
            <div className="top-pic">{user?.name?.[0] || 'A'}</div>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}