import { useState } from 'react';
import { LayoutDashboard, Users, Lock, LogOut, Brain } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import GestaoTime from './pages/GestaoTime';
import IntelFinanceira from './pages/IntelFinanceira';
import RegistroVenda from './pages/RegistroVenda';

// ─── Aba de navegação ────────────────────────────────────────────────────────

function NavTab({ pagina, ativa, onClick, disabled }) {
  const Icon = pagina.icon;
  const ativo = ativa === pagina.id;
  return (
    <button
      onClick={() => !disabled && onClick(pagina.id)}
      disabled={disabled}
      title={disabled ? 'Acesso restrito a administradores' : undefined}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200
                  ${ativo
                    ? 'border-gold text-gold'
                    : disabled
                      ? 'border-transparent text-gold-muted/30 cursor-not-allowed'
                      : 'border-transparent text-gold-muted hover:text-gold-light hover:border-gold-dark/40'}`}
    >
      <Icon size={15} />
      {pagina.label}
      {pagina.admin && (
        <Lock size={10} className={`${ativo ? 'text-gold' : 'text-gold-muted'} opacity-50`} />
      )}
    </button>
  );
}

// ─── App autenticado ─────────────────────────────────────────────────────────

function AppAutenticado() {
  const { user, isAdmin, isOperador, logout } = useAuth();
  const [pagina, setPagina] = useState('dashboard');

  // ── Operador: tela exclusiva de registro (sem nav, sem dashboard) ──────────
  if (isOperador) {
    return (
      <div className="min-h-screen bg-onix-gradient">
        <Header />
        <RegistroVenda />
        <button
          onClick={logout}
          title="Sair"
          className="fixed bottom-5 right-5 p-2.5 bg-surface-card border border-surface-border rounded-full
                     text-gold-muted hover:text-gold transition-colors shadow-card z-50"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  const PAGINAS = [
    { id: 'dashboard',    label: 'Dashboard',               icon: LayoutDashboard, admin: false },
    { id: 'inteligencia', label: 'Inteligência Financeira',  icon: Brain,           admin: true  },
    { id: 'gestao',       label: 'Gestão de Time',           icon: Users,           admin: true  },
  ];

  // Barbeiro não acessa abas admin
  const paginaAtual = !isAdmin && pagina !== 'dashboard' ? 'dashboard' : pagina;

  return (
    <div className="min-h-screen bg-onix-gradient">
      <Header />

      {/* Barra de navegação */}
      <nav className="border-b border-surface-border bg-onix-200/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center">
          <div className="flex gap-1 flex-1">
            {PAGINAS.map((p) => (
              <NavTab
                key={p.id}
                pagina={p}
                ativa={paginaAtual}
                onClick={setPagina}
                disabled={p.admin && !isAdmin}
              />
            ))}
          </div>

          {/* Info do usuário + Sair */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-gold-light">{user?.nome}</span>
              <span className={`text-[10px] uppercase tracking-wider font-bold ${isAdmin ? 'text-gold' : 'text-blue-400'}`}>
                {isAdmin ? 'Admin' : 'Barbeiro'}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="p-2 text-gold-muted hover:text-gold transition-colors rounded-lg hover:bg-surface-hover"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </nav>

      {/* Conteúdo */}
      <div className="animate-fade-in" key={paginaAtual}>
        {paginaAtual === 'dashboard'    && <Dashboard />}
        {paginaAtual === 'inteligencia' && isAdmin && <IntelFinanceira />}
        {paginaAtual === 'gestao'       && isAdmin && <GestaoTime />}
      </div>
    </div>
  );
}

// ─── Raiz: Auth gate ─────────────────────────────────────────────────────────

function AppRoot() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppAutenticado /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
