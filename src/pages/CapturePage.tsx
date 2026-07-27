import React, { useState } from 'react';
import { Background360, AnchorPoint, UserPoseState } from '../types';
import { Panorama360Viewer } from '../components/Panorama360Viewer';
import { CameraStream } from '../components/CameraStream';
import { Camera, Sliders, Check, Shield, SwitchCamera, Video, VideoOff } from 'lucide-react';
import { saveCaptureSnapshot } from '../services/firebase';

interface CapturePageProps {
  backgrounds: Background360[];
  selectedBackgroundId: string;
  onSelectBackground: (bg: Background360) => void;
  userPoseState: UserPoseState;
  setUserPoseState: React.Dispatch<React.SetStateAction<UserPoseState>>;
  anchors: AnchorPoint[];
  userCameraCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const CapturePage: React.FC<CapturePageProps> = ({
  backgrounds,
  selectedBackgroundId,
  onSelectBackground,
  userPoseState,
  setUserPoseState,
  anchors,
  userCameraCanvasRef
}) => {
  const [cameraFacing, setCameraFacing] = useState<'rear' | 'front' | 'mirror'>('front');
  const [isRecording, setIsRecording] = useState<boolean>(true);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  const currentBackground = backgrounds.find(b => b.id === selectedBackgroundId) || backgrounds[0];

  const handleShutterCapture = () => {
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    // Captura o canvas WebGL do visualizador 360°
    const webglCanvas = document.querySelector('canvas');
    if (webglCanvas) {
      try {
        const dataUrl = webglCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `360you-Capture-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        // Salva cópia da captura no Firestore do Usuário
        saveCaptureSnapshot(dataUrl, selectedBackgroundId).catch(err => {
          console.warn('Persistência no Firestore falhou:', err);
        });
      } catch (err) {
        console.error('Erro ao capturar imagem da câmera 360:', err);
      }
    }
  };

  const cycleCameraFacing = () => {
    if (cameraFacing === 'front') setCameraFacing('rear');
    else if (cameraFacing === 'rear') setCameraFacing('mirror');
    else setCameraFacing('front');
  };

  return (
    <div className="relative w-full h-[calc(100vh-112px)] flex flex-col items-center justify-center overflow-hidden select-none bg-[#080808] p-2 sm:p-4">
      
      {/* Shutter Flash Animation */}
      {shutterFlash && (
        <div className="fixed inset-0 z-50 bg-white opacity-90 transition-opacity duration-150 pointer-events-none" />
      )}

      {/* CONTAINER VERTICAL FULL HD 1080x1920 COM CÂMERA DO USUÁRIO SOBREPOSTA AO 360° */}
      <div className="relative w-full max-w-[440px] h-full max-h-[900px] aspect-[9/16] bg-[#0A0A0A] rounded-[32px] sm:rounded-[40px] border-[3px] border-[#252525] shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col justify-between">
        
        {/* Live HUD Header */}
        <div className="absolute top-0 inset-x-0 z-30 pointer-events-none flex flex-col items-center pt-3 px-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent pb-6">
          <div className="flex items-center justify-between w-full text-[11px] font-mono text-slate-300">
            <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-bold text-[#FF9900]">1080x1920 FULL HD</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-200">30 FPS</span>
            </div>

            <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
              <span className="text-slate-400">MODO:</span>
              <span className="font-bold text-slate-100 uppercase">{cameraFacing}</span>
            </div>
          </div>
        </div>

        {/* 360° Background Scene (Fundo em 360°) */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
          <Panorama360Viewer
            currentBackground={currentBackground}
            userPoseState={userPoseState}
            onPoseChange={setUserPoseState}
            userCameraCanvasRef={userCameraCanvasRef}
            anchors={anchors}
          />
        </div>

        {/* JANELA DE VISUALIZAÇÃO FULL HD 1080x1920: CANVAS DA CÂMERA DO USUÁRIO SOBREPOSTO AO 360° */}
        <div className="absolute inset-0 z-10 w-full h-full overflow-hidden flex items-center justify-center">
          <canvas
            ref={userCameraCanvasRef}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Action Overlay: Solicita permissão / ativação da câmera */}
        {!isCameraActive && !showSettingsDrawer && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-black/60 backdrop-blur-sm pointer-events-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FF9900]/20 border border-[#FF9900]/50 flex items-center justify-center text-[#FF9900]">
              <Camera className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-xs font-mono text-slate-200 max-w-xs">
              Exibindo a imagem capturada da câmera do usuário na janela Full HD Vertical 1080x1920 sobre o cenário 360°.
            </p>
            <button
              onClick={() => setShowSettingsDrawer(true)}
              className="px-4 py-2.5 bg-[#FF9900] hover:bg-[#ffaa2b] text-slate-950 font-bold font-mono text-xs rounded-xl transition-all shadow-lg active:scale-95 flex items-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>ATIVAR CÂMERA AO VIVO</span>
            </button>
          </div>
        )}

        {/* Botão Flutuante de Ajustes de Câmera (Top Right) */}
        <div className="absolute top-12 right-4 z-30">
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className="p-2.5 bg-[#0E0E0E]/85 backdrop-blur-md hover:bg-[#201f1f] text-slate-200 border border-[#444748] rounded-full transition-all shadow-xl active:scale-95 flex items-center space-x-1.5 text-xs font-mono"
            title="Ajustes de Câmera e Recorte IA"
          >
            <Sliders className="w-4 h-4 text-[#FF9900]" />
            <span className="hidden sm:inline text-[11px] font-semibold text-slate-300">AJUSTES</span>
          </button>
        </div>

        {/* Persistent Camera Stream Capture Engine */}
        <div className={showSettingsDrawer ? 'absolute top-20 right-4 left-4 z-40 p-4 bg-[#131313]/95 backdrop-blur-xl border border-[#353534] rounded-2xl shadow-2xl space-y-4 text-xs font-mono' : 'absolute -top-[9999px] -left-[9999px] w-[640px] h-[480px] pointer-events-none opacity-0'}>
          {showSettingsDrawer && (
            <div className="flex items-center justify-between border-b border-[#353534] pb-2">
              <span className="font-bold text-slate-100 uppercase tracking-widest flex items-center space-x-2">
                <Shield className="w-4 h-4 text-[#FF9900]" />
                <span>Controles do Recorte IA</span>
              </span>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                className="text-slate-400 hover:text-white px-2 py-0.5 rounded bg-[#201f1f]"
              >
                ✕
              </button>
            </div>
          )}

          <CameraStream
            userPoseState={userPoseState}
            onPoseChange={setUserPoseState}
            canvasRef={userCameraCanvasRef}
            cameraFacing={cameraFacing}
            onStreamActiveChange={setIsCameraActive}
          />
        </div>

        {/* OVERLAY INFERIOR: Controles na Horizontal (Apenas Ícones) + Seleção de Fundo 360° */}
        <div className="mt-auto relative z-20 flex flex-col gap-3 pb-5 px-3 bg-gradient-to-t from-black via-black/85 to-transparent pt-8">
          
          {/* Indicator Badge: Front Camera Layer + 360 Background Layer */}
          <div className="text-center">
            <span className="px-2.5 py-0.5 bg-black/70 backdrop-blur-md text-[9px] font-mono text-slate-300 rounded-full border border-white/10 uppercase tracking-widest inline-flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9900]" />
              <span>SOBREPOSIÇÃO: CÂMERA (FRENTE) + CENÁRIO 360° (FUNDO)</span>
            </span>
          </div>

          {/* LINHA HORIZONTAL DE CONTROLES DA CÂMERA (APENAS ÍCONES) */}
          <div className="flex items-center justify-center gap-6 py-1">
            
            {/* 1. Seleção de Câmera / Modo (Ícone Apenas) */}
            <button
              onClick={cycleCameraFacing}
              className="w-11 h-11 rounded-full bg-[#131313]/90 hover:bg-[#201f1f] border border-[#353534] hover:border-[#FF9900] text-[#FF9900] flex items-center justify-center transition-all shadow-lg active:scale-95"
              title={`Modo de Câmera: ${cameraFacing.toUpperCase()} (Clique para alternar)`}
              aria-label={`Modo de Câmera ${cameraFacing.toUpperCase()}`}
            >
              <SwitchCamera className="w-5 h-5" />
            </button>

            {/* 2. Tirar Foto (Ícone Apenas) */}
            <button
              onClick={handleShutterCapture}
              className="w-14 h-14 rounded-full bg-[#FF9900] hover:bg-[#ffaa2b] text-slate-950 flex items-center justify-center transition-all shadow-xl active:scale-95 ring-4 ring-[#FF9900]/20"
              title="Tirar Foto Instantânea"
              aria-label="Tirar Foto Instantânea"
            >
              <Camera className="w-6 h-6" />
            </button>

            {/* 3. Gravação de Vídeo (Ícone Apenas) */}
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border shadow-lg active:scale-95 ${
                isRecording
                  ? 'bg-rose-950/80 border-rose-600/80 text-rose-400 hover:bg-rose-900 ring-2 ring-rose-500/30'
                  : 'bg-[#131313]/90 border-[#353534] text-slate-400 hover:text-slate-200 hover:bg-[#201f1f]'
              }`}
              title={isRecording ? 'Gravando Vídeo (Clique para parar)' : 'Iniciar Gravação de Vídeo'}
              aria-label="Alternar Gravação de Vídeo"
            >
              {isRecording ? (
                <Video className="w-5 h-5 text-rose-500 animate-pulse" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </button>

          </div>

          {/* Carrossel de Seleção dos Quadros de Fundo 360° (BKG 01, BKG 02...) */}
          <div className="w-full overflow-x-auto flex gap-3 px-1 pb-1 no-scrollbar">
            {backgrounds.map((bg, idx) => {
              const isSelected = bg.id === selectedBackgroundId;
              const bgNum = (idx + 1).toString().padStart(2, '0');

              return (
                <div
                  key={bg.id}
                  onClick={() => onSelectBackground(bg)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer group"
                >
                  <div
                    className={`w-14 h-14 border transition-all overflow-hidden relative shadow-lg rounded-xl ${
                      isSelected
                        ? 'border-white ring-2 ring-[#FF9900] scale-105'
                        : 'border-[#E0E0E0]/60 opacity-80 group-hover:opacity-100 group-hover:border-white'
                    } bg-[#353534]`}
                  >
                    <img
                      src={bg.thumbnailUrl || bg.dataUrl}
                      alt={bg.title}
                      className="w-full h-full object-cover"
                      no-referrer="no-referrer"
                    />
                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-[#FF9900] rounded-full flex items-center justify-center text-slate-950">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-widest ${isSelected ? 'text-white font-bold' : 'text-[#c4c7c8]'}`}>
                    BKG {bgNum}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
};

