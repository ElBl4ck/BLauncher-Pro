import ProfileCard from './components/ProfileCard';
import { useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import Login from './pages/Login';

export default function App() {
  const { session, cargando, entrando, error, login, logout, relink } = useAuth();

  if (cargando) {
    return <div className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-500">Cargando…</div>;
  }

  // Sin sesión no se muestra nada más: el launcher no funciona sin login
  if (!session) return <Login onLogin={login} entrando={entrando} error={error} />;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <header className="flex justify-end p-4">
        <ProfileCard session={session} onLogout={logout} onRelink={relink} />
      </header>
      <Home />
    </div>
  );
}