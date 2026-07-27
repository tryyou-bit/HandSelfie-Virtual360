import React, { useState, useRef, useEffect } from 'react';
import { TopHeader } from './components/TopHeader';
import { BottomNav, ActivePage } from './components/BottomNav';
import { CapturePage } from './pages/CapturePage';
import { Library360 } from './components/Library360';
import { Converter2D } from './components/Converter2D';
import { SecurityInspector } from './components/SecurityInspector';

import { Background360, AnchorPoint, UserPoseState, SecurityStatus } from './types';
import { generateProcedural360Backgrounds } from './utils/sample360';
import { SecurityEngine } from './services/security';
import { ensureAuthUser, fetchUserBackgrounds, saveBackgroundToFirestore, saveUserPreset } from './services/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActivePage>('camera');
  
  // Lista de Cenários 360° Inicializada com Panoramas Procedurais em Alta Resolução
  const [backgrounds, setBackgrounds] = useState<Background360[]>(() => generateProcedural360Backgrounds());
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string>('cyberpunk-neon');

  // Estado do Corpo e Posicionamento na Cena 3D
  const [userPoseState, setUserPoseState] = useState<UserPoseState>({
    isCutoutActive: true,
    bodyOpacity: 1.0,
    bodyScale: 1.0,
    positionY: 0,
    positionX: 0,
    activeAnchorId: 'anchor-center',
    segmentationThreshold: 90,
    feathering: 0.15,
    segmentationEngine: 'mediapipe',
    chromaMode: 'green',
    chromaTargetColor: '#00FF00',
    chromaTolerance: 0.25,
    spillSuppression: 0.5
  });

  // Pontos de Ancoragem 3D Disponíveis na Cena
  const anchors: AnchorPoint[] = [
    { id: 'anchor-left', label: 'Ancorar Esquerda', x: -0.6, y: 0.0, z: -1.0 },
    { id: 'anchor-center', label: 'Ancorar Centro', x: 0.0, y: 0.0, z: -1.0 },
    { id: 'anchor-right', label: 'Ancorar Direita', x: 0.6, y: 0.0, z: -1.0 },
  ];

  // Ref do Canvas de Processamento de Vídeo da Câmera
  const userCameraCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Status de Segurança SecOps
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>(() => ({
    ...SecurityEngine.getInstance().getStatus(),
    firebaseRulesValidated: true
  }));

  // Inicializa o Firebase Auth e Sincroniza Cenários Salvos no Firestore
  useEffect(() => {
    let isMounted = true;
    
    SecurityEngine.getInstance().startAntiDebugProtection(() => {
      if (isMounted) {
        setSecurityStatus({
          ...SecurityEngine.getInstance().getStatus(),
          firebaseRulesValidated: true
        });
      }
    });

    ensureAuthUser()
      .then(() => fetchUserBackgrounds())
      .then((remoteBgs) => {
        if (isMounted && remoteBgs && remoteBgs.length > 0) {
          setBackgrounds(prev => {
            const existingIds = new Set(prev.map(b => b.id));
            const newFromRemote = remoteBgs.filter(b => !existingIds.has(b.id));
            return [...newFromRemote, ...prev];
          });
        }
      })
      .catch(err => {
        console.warn('Sincronização Firebase Firestore inicial:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Salva alterações de presets no Firestore
  useEffect(() => {
    const timer = setTimeout(() => {
      saveUserPreset(userPoseState).catch(err => console.warn('Falha ao salvar preset Firestore:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [userPoseState]);

  const handleAddBackgroundToLibrary = (newBg: Background360) => {
    setBackgrounds(prev => [newBg, ...prev]);
    setSelectedBackgroundId(newBg.id);
    saveBackgroundToFirestore(newBg).catch(err => console.warn('Erro ao persisitir cenário no Firestore:', err));
  };

  const handleSelectBackground = (bg: Background360) => {
    setSelectedBackgroundId(bg.id);
  };

  const handleUpdateBackgroundMetadata = (bgId: string, metadata: Partial<Background360>) => {
    setBackgrounds(prev => {
      const updated = prev.map(b => b.id === bgId ? { ...b, ...metadata } : b);
      const target = updated.find(b => b.id === bgId);
      if (target) {
        saveBackgroundToFirestore(target).catch(err => console.warn('Erro ao atualizar Firestore:', err));
      }
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FFFFFF] font-sans selection:bg-[#FF9900] selection:text-[#131313] flex flex-col overflow-x-hidden">
      
      {/* Top Header com Apenas a Logo '360you' e Ícone de Ajustes de Perfil */}
      <TopHeader onOpenSettings={() => setActiveTab('security')} />

      {/* Main Pages Container */}
      <main className={`flex-1 w-full ${activeTab === 'camera' ? 'pt-14 pb-14' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24'}`}>
        
        {/* PAGE 1: CAPTURE (Visão de Câmera Ampliada de Canto a Canto com Fundo e Controles Sobrepostos) */}
        {activeTab === 'camera' && (
          <CapturePage
            backgrounds={backgrounds}
            selectedBackgroundId={selectedBackgroundId}
            onSelectBackground={handleSelectBackground}
            userPoseState={userPoseState}
            setUserPoseState={setUserPoseState}
            anchors={anchors}
            userCameraCanvasRef={userCameraCanvasRef}
          />
        )}

        {/* PAGE 2: LIBRARY (Biblioteca 360° & Análise de Iluminação Gemini IA) */}
        {activeTab === 'library' && (
          <div className="py-2">
            <Library360
              backgrounds={backgrounds}
              selectedBackgroundId={selectedBackgroundId}
              onSelectBackground={(bg) => {
                handleSelectBackground(bg);
                setActiveTab('camera');
              }}
              onUpdateBackgroundMetadata={handleUpdateBackgroundMetadata}
            />
          </div>
        )}

        {/* PAGE 3: EDIT (Conversor de Imagens 2D para Projeção Equirretangular 360°) */}
        {activeTab === 'converter' && (
          <div className="py-2">
            <Converter2D
              onAddBackgroundToLibrary={handleAddBackgroundToLibrary}
              onSelectBackground={(bg) => {
                handleSelectBackground(bg);
                setActiveTab('camera');
              }}
            />
          </div>
        )}

        {/* PAGE 4: SETTINGS & PROFILE (Ajustes de Perfil, Configurações e SecOps) */}
        {activeTab === 'security' && (
          <div className="py-2">
            <SecurityInspector status={securityStatus} />
          </div>
        )}

      </main>

      {/* Fixed Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

    </div>
  );
}
