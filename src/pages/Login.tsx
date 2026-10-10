interface Props {
  onLogin: () => void;
  entrando: boolean;
  error: string | null;
}

import logo from '../assets/img/BlLauncher-logo.png';
import microsoftLogo from '../assets/img/microsoft-logo.png';

export default function Login({ onLogin, entrando, error }: Props) {
  return (
    
    
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      
      <img src={logo} alt="BL Launcher Logo" className="w-[300px] h-auto object-contain"
      />
      
      <p className="max-w-sm text-center text-zinc-400 mb-[20px]">
        Para poder jugar es necesario <b>Iniciar Sesión</b> con tu cuenta de Microsoft.
      </p>
      
      
      <button
        onClick={onLogin}
        disabled={entrando}
        className="relative flex items-center justify-center w-6 bg-zinc-600 hover:bg-zinc-500 text-white font-medium px-4 py-2 rounded-md transition-colors mt-[40px] cursor-pointer"
      > 
      <img src={microsoftLogo} alt="Logo de Microsoft" className="w-[30px] h-auto " /> 
      
      <span className="leading-none">{entrando ? 'Esperando a Microsoft…' : 'Iniciar sesión'}</span>

      </button>
      {error && <p className="max-w-sm text-center text-sm text-red-400">{error}</p>}
      
      
      
      <style>{`
        body {
          background-color: #111111;
          color: #ffffff;
        },
        h1{
        
          justify-content: center;
          
          }
      `}</style>

      <p className="max-w-sm text-center text-zinc-400 mt-[20px] text-[10px]">
        Al iniciar sesión, aceptas los <a href="https://www.microsoft.com/en-us/servicesagreement/" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">Términos de Servicio de Microsoft</a> y la <a href="https://privacy.microsoft.com/en-us/privacystatement" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">Política de Privacidad de Microsoft</a>.
      </p>
    </div>
    
    
  );
}