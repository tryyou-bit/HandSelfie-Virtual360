import React from 'react';
import { Settings } from 'lucide-react';

interface TopHeaderProps {
  onOpenSettings: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-[#353534]/60 px-4 sm:px-8 py-3 flex items-center justify-between select-none">
      
      {/* Esquerda: Logo da Aplicação "360you" */}
      <div className="flex items-center space-x-2">
        <svg
          viewBox="0 0 240 60"
          className="h-7 sm:h-8 w-auto fill-current"
          alt="360you Logo"
        >
          {/* Logo 360you: 360 em branco + you em laranja #FF9900 */}
          <g className="font-sans">
            {/* Texto 360 em Branco */}
            <text
              x="0"
              y="45"
              fill="#FFFFFF"
              fontSize="48"
              fontWeight="900"
              fontFamily="Sora, sans-serif"
              letterSpacing="-0.04em"
            >
              360
            </text>
            {/* Texto you em Laranja Vibrant #FF9900 */}
            <text
              x="95"
              y="45"
              fill="#FF9900"
              fontSize="48"
              fontWeight="900"
              fontFamily="Sora, sans-serif"
              letterSpacing="-0.03em"
            >
              you
            </text>
          </g>
        </svg>
      </div>

      {/* Direita: Apenas Ícone de Configurações para Ajustes de Perfil */}
      <button
        onClick={onOpenSettings}
        title="Ajustes de Perfil e Configurações"
        aria-label="Ajustes de Perfil e Configurações"
        className="p-2 text-[#E5E2E1] hover:text-[#FF9900] hover:bg-[#201f1f] rounded-lg transition-all border border-transparent hover:border-[#353534]"
      >
        <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

    </header>
  );
};
