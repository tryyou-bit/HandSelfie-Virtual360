import React, { useEffect, useRef, useState } from 'react';
import { UserPoseState } from '../types';
import { Camera, VideoOff, Sparkles, Eye, RefreshCw, Palette, Sliders, Layers, Cpu } from 'lucide-react';
import { SelfieSegmentation, Results } from '@mediapipe/selfie_segmentation';

interface CameraStreamProps {
  userPoseState: UserPoseState;
  onPoseChange: (updater: (prev: UserPoseState) => UserPoseState) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraFacing?: 'front' | 'rear' | 'mirror';
  onStreamActiveChange?: (active: boolean) => void;
}

export const CameraStream: React.FC<CameraStreamProps> = ({
  userPoseState,
  onPoseChange,
  canvasRef,
  cameraFacing = 'front',
  onStreamActiveChange
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmenterRef = useRef<SelfieSegmentation | null>(null);

  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAiLoaded, setIsAiLoaded] = useState<boolean>(false);

  const isStartingRef = useRef<boolean>(false);
  const isProcessingFrameRef = useRef<boolean>(false);

  // Ref sempre atualizada para evitar recriar a instância da IA MediaPipe a cada ajuste de slider
  const userPoseStateRef = useRef(userPoseState);
  useEffect(() => {
    userPoseStateRef.current = userPoseState;
  }, [userPoseState]);

  // Inicializa o Modelo de IA MediaPipe Selfie Segmentation (100% Client-Side)
  useEffect(() => {
    let isMounted = true;

    try {
      const selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 1 = modelo de corpo e paisagem otimizado para navegadores
        selfieMode: false
      });

      selfieSegmentation.onResults((results: Results) => {
        if (!isMounted) return;

        const canvas = (canvasRef && canvasRef.current) ? canvasRef.current : internalCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const vW = results.image.width || canvas.width || 1280;
        const vH = results.image.height || canvas.height || 720;

        if (canvas.width !== vW) canvas.width = vW;
        if (canvas.height !== vH) canvas.height = vH;

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Solução B: Supersampling & HD Quality Canvas Context
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const isMirrored = cameraFacing === 'mirror' || cameraFacing === 'front';

        // Aplica a transformação de espelhamento horizontal PRIMEIRO para alinhar máscara e imagem em perfeita sincronia
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        const currentState = userPoseStateRef.current;

        // Pós-Processamento de Contraste Alpha (Curva Sigmoide) no Canvas 2D:
        // O blur suaviza os pixels da máscara e o contraste aplica a inclinação sigmoide para definir bordas nítidas de cabelo e rosto sem halo
        const featheringVal = currentState.feathering ?? 0.15;
        const thresholdVal = currentState.segmentationThreshold ?? 90;
        
        const blurRadius = Math.max(1, Math.round(featheringVal * 8));
        const contrastPct = Math.round(110 + (thresholdVal / 100) * 150); // Mapeia threshold para inclinação da curva de contraste (110% a 260%)

        // --- OPÇÃO 2: DUPLA PASSAGEM DE RECORTE (DUAL-PASS SEGMENTATION) ---
        // Pass 1: Máscara Base MediaPipe Selfie Segmentation com filtro Sigmoide
        // Pass 2: Camada de Proteção e Re-amplificação Alpha da Zona do Rosto/Cabelo (Região Superior)

        if (!maskCanvasRef.current) {
          maskCanvasRef.current = document.createElement('canvas');
        }
        const maskCanvas = maskCanvasRef.current;
        if (maskCanvas.width !== vW) maskCanvas.width = vW;
        if (maskCanvas.height !== vH) maskCanvas.height = vH;
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

        if (maskCtx) {
          maskCtx.clearRect(0, 0, vW, vH);
          maskCtx.imageSmoothingEnabled = true;
          maskCtx.imageSmoothingQuality = 'high';

          // Pass 1: Desenha a máscara alpha base com desfoque e contraste sigmoide
          maskCtx.filter = `blur(${blurRadius}px) contrast(${contrastPct}%)`;
          maskCtx.drawImage(results.segmentationMask, 0, 0, vW, vH);
          maskCtx.filter = 'none';

          // Pass 2: Reforço Alpha na zona superior (Rosto, Cabelos, Orelhas) para recuperar fios finos atenuados pela IA
          const headRegionY = vH * 0.45;
          const headGradient = maskCtx.createLinearGradient(0, 0, 0, headRegionY);
          headGradient.addColorStop(0, 'rgba(255, 255, 255, 0.45)');  // Reforço no topo do cabelo
          headGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)'); // Reforço suave nas orelhas/bochechas
          headGradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');   // Transição imperceptível no pescoço

          maskCtx.save();
          maskCtx.globalCompositeOperation = 'source-atop';
          maskCtx.fillStyle = headGradient;
          maskCtx.fillRect(0, 0, vW, headRegionY);
          maskCtx.restore();
        }

        // 1. Desenha a Máscara Composta Dual-Pass no Canvas Principal
        ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
        
        // Remove o filtro para desenhar o vídeo original de alta definição sem desfoque
        ctx.filter = 'none';

        // 2. Operação de composição 'source-in' para isolar o assunto com fundo 100% transparente e bordas anti-serrilhadas
        ctx.globalCompositeOperation = 'source-in';

        // 3. Desenha a imagem do vídeo com a mesma transformação alinhada
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        // Ajuste opcional de opacidade do corpo se configurado
        const opacity = currentState.bodyOpacity ?? 1.0;
        if (opacity < 1.0) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = `rgba(0, 0, 0, ${1 - opacity})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.restore();

        // Copia para o preview auxiliar se ativo
        if (drawerCanvasRef.current) {
          const dCanvas = drawerCanvasRef.current;
          if (dCanvas.width !== canvas.width) dCanvas.width = canvas.width;
          if (dCanvas.height !== canvas.height) dCanvas.height = canvas.height;
          const dCtx = dCanvas.getContext('2d');
          if (dCtx) {
            dCtx.imageSmoothingEnabled = true;
            dCtx.imageSmoothingQuality = 'high';
            dCtx.clearRect(0, 0, dCanvas.width, dCanvas.height);
            dCtx.drawImage(canvas, 0, 0);
          }
        }
      });

      segmenterRef.current = selfieSegmentation;
      setIsAiLoaded(true);
    } catch (err) {
      console.warn('Erro ao inicializar o MediaPipe Selfie Segmentation:', err);
    }

    return () => {
      isMounted = false;
      if (segmenterRef.current) {
        segmenterRef.current.close();
        segmenterRef.current = null;
      }
    };
  }, [cameraFacing]);

  // Inicializa o Stream de Vídeo HD da Câmera com Fallback Seguro e Trava a 30 FPS
  const startCamera = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      setCameraError(null);

      // Interrompe stream anterior se houver e aguarda liberação do hardware
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        // Pequeno delay para garantir que o SO/Navegador liberou a fonte de vídeo
        await new Promise(r => setTimeout(r, 150));
      }

      const facingConstraint = cameraFacing === 'rear'
        ? 'environment'
        : 'user';

      let stream: MediaStream | null = null;

      // Tenta inicializar stream com resolução Full HD / HD travado em max 30 FPS para dar folga de processamento à IA
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingConstraint },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: false
        });
      } catch (err) {
        console.warn('Tentativa com resolução Full HD falhou, tentando HD 720p a 30 FPS...', err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingConstraint },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 }
            },
            audio: false
          });
        } catch (hdErr) {
          console.warn('Tentativa com HD falhou, utilizando fallback básico de câmera a 30 FPS...', hdErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingConstraint,
              frameRate: { ideal: 30, max: 30 }
            },
            audio: false
          });
        }
      }

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('video.play() exigiu interação do usuário ou foi suspenso:', playErr);
        }
        setStreamActive(true);
        if (onStreamActiveChange) onStreamActiveChange(true);
        // Ativação automática do efeito de sobreposição e remoção de fundo
        onPoseChange(prev => ({ ...prev, isCutoutActive: true }));
      }
    } catch (err: any) {
      console.warn('Acesso inicial à câmera aguardando permissão do usuário:', err);
      setStreamActive(false);
      if (onStreamActiveChange) onStreamActiveChange(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('not allowed')) {
        setCameraError('Clique no botão abaixo para ativar a câmera no seu navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Nenhuma câmera foi encontrada no dispositivo.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('A câmera está em uso por outro aplicativo. Feche outras abas e tente novamente.');
      } else {
        setCameraError('Clique no botão abaixo para ativar e conectar sua câmera.');
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setStreamActive(false);
      if (onStreamActiveChange) onStreamActiveChange(false);
    }
  };

  // Tenta auto-iniciar a câmera ao montar ou ao mudar modo (front / rear / mirror) e ativa o efeito de sobreposição
  useEffect(() => {
    onPoseChange(prev => ({ ...prev, isCutoutActive: true }));
    startCamera();

    return () => {
      stopCamera();
    };
  }, [cameraFacing]);

  // Processador de Frame e Recorte Corporal em Tempo Real (Canvas Loop)
  useEffect(() => {
    let animationId: number;

    const processFrame = () => {
      animationId = requestAnimationFrame(processFrame);

      const video = videoRef.current;
      const canvas = (canvasRef && canvasRef.current) ? canvasRef.current : internalCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const engine = userPoseState.segmentationEngine || 'mediapipe';

      if (userPoseState.isCutoutActive && engine === 'mediapipe' && segmenterRef.current && isAiLoaded) {
        if (!isProcessingFrameRef.current) {
          isProcessingFrameRef.current = true;
          segmenterRef.current.send({ image: video })
            .catch(err => console.warn('Erro na inferência MediaPipe:', err))
            .finally(() => { isProcessingFrameRef.current = false; });
        }
        return;
      }

      // Algoritmo Fallback de Chroma Key por Canvas 2D
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const vW = video.videoWidth || 640;
      const vH = video.videoHeight || 480;

      if (canvas.width !== vW) canvas.width = vW;
      if (canvas.height !== vH) canvas.height = vH;

      ctx.save();

      // Espelhamento horizontal para modo mirror ou front selfie
      const isMirrored = cameraFacing === 'mirror' || cameraFacing === 'front';
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      // Desenha frame de vídeo bruto no canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      if (userPoseState.isCutoutActive) {
        // Algoritmo Avançado de Chroma Key & Remoção de Fundo
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frameData.data;

        const mode = userPoseState.chromaMode || 'green';
        const tolerance = userPoseState.chromaTolerance ?? 0.25;
        const feathering = userPoseState.feathering ?? 0.15;
        const spill = userPoseState.spillSuppression ?? 0.5;
        const opacity = userPoseState.bodyOpacity ?? 1.0;
        const targetHex = userPoseState.chromaTargetColor || '#00FF00';

        let targetR = 0, targetG = 255, targetB = 0;
        if (targetHex && targetHex.startsWith('#') && targetHex.length === 7) {
          targetR = parseInt(targetHex.slice(1, 3), 16);
          targetG = parseInt(targetHex.slice(3, 5), 16);
          targetB = parseInt(targetHex.slice(5, 7), 16);
        }

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          let alphaFactor = 1.0;

          if (mode === 'green') {
            const maxRB = Math.max(r, b);
            const greenDiff = (g - maxRB) / 255;
            const keyThreshold = tolerance * 0.7;
            const feather = Math.max(0.01, feathering);

            if (greenDiff > keyThreshold) {
              if (greenDiff > keyThreshold + feather) {
                alphaFactor = 0.0;
              } else {
                alphaFactor = 1.0 - ((greenDiff - keyThreshold) / feather);
              }
            } else {
              alphaFactor = 1.0;
            }

            if (g > maxRB && spill > 0) {
              const spillAmount = (g - maxRB) * spill;
              data[i + 1] = Math.max(0, Math.round(g - spillAmount));
            }
          } else if (mode === 'blue') {
            const maxRG = Math.max(r, g);
            const blueDiff = (b - maxRG) / 255;
            const keyThreshold = tolerance * 0.7;
            const feather = Math.max(0.01, feathering);

            if (blueDiff > keyThreshold) {
              if (blueDiff > keyThreshold + feather) {
                alphaFactor = 0.0;
              } else {
                alphaFactor = 1.0 - ((blueDiff - keyThreshold) / feather);
              }
            } else {
              alphaFactor = 1.0;
            }

            if (b > maxRG && spill > 0) {
              const spillAmount = (b - maxRG) * spill;
              data[i + 2] = Math.max(0, Math.round(b - spillAmount));
            }
          } else if (mode === 'custom') {
            const distR = r - targetR;
            const distG = g - targetG;
            const distB = b - targetB;
            const normDist = Math.sqrt(distR * distR + distG * distG + distB * distB) / 441.67;

            const feather = Math.max(0.01, feathering);
            if (normDist < tolerance) {
              alphaFactor = 0.0;
            } else if (normDist < tolerance + feather) {
              alphaFactor = (normDist - tolerance) / feather;
            } else {
              alphaFactor = 1.0;
            }
          } else if (mode === 'luma') {
            const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            const targetLuma = (userPoseState.segmentationThreshold || 90) / 255;
            const feather = Math.max(0.01, feathering);

            const lumaDiff = Math.abs(luma - targetLuma);
            if (lumaDiff < tolerance) {
              alphaFactor = 0.0;
            } else if (lumaDiff < tolerance + feather) {
              alphaFactor = (lumaDiff - tolerance) / feather;
            } else {
              alphaFactor = 1.0;
            }
          }

          const finalAlpha = Math.min(255, Math.max(0, Math.round(data[i + 3] * alphaFactor * opacity)));
          data[i + 3] = finalAlpha;
        }

        ctx.putImageData(frameData, 0, 0);
      }

      // Copia frame processado para o preview do drawer de ajustes se estiver ativo
      if (drawerCanvasRef.current) {
        const dCanvas = drawerCanvasRef.current;
        if (dCanvas.width !== canvas.width) dCanvas.width = canvas.width;
        if (dCanvas.height !== canvas.height) dCanvas.height = canvas.height;
        const dCtx = dCanvas.getContext('2d');
        if (dCtx) {
          dCtx.clearRect(0, 0, dCanvas.width, dCanvas.height);
          dCtx.drawImage(canvas, 0, 0);
        }
      }
    };

    if (streamActive) {
      processFrame();
    }

    return () => cancelAnimationFrame(animationId);
  }, [streamActive, userPoseState, cameraFacing]);

  return (
    <div className="bg-[#181818] border border-[#353534] rounded-2xl p-4 shadow-xl space-y-4 text-slate-200">
      
      {/* Elemento de Vídeo e Canvas de Processamento Principal da Câmera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      {!canvasRef && (
        <canvas
          ref={internalCanvasRef}
          style={{ position: 'fixed', top: -9999, left: -9999, width: 1080, height: 1920, opacity: 0, pointerEvents: 'none' }}
        />
      )}

      {/* Header do Módulo de Câmera */}
      <div className="flex items-center justify-between pb-3 border-b border-[#353534]">
        <div className="flex items-center space-x-2">
          <Camera className="w-5 h-5 text-[#FF9900]" />
          <h2 className="text-xs font-bold font-mono text-slate-100 uppercase tracking-wider">Stream ao Vivo da Câmera</h2>
        </div>

        <div className="flex items-center space-x-2">
          {!streamActive ? (
            <button
              onClick={startCamera}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FF9900] hover:bg-[#ffaa2b] text-slate-950 transition-all shadow-md"
            >
              <Camera className="w-4 h-4" />
              <span>Ativar Câmera</span>
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-all"
            >
              <VideoOff className="w-4 h-4" />
              <span>Desativar</span>
            </button>
          )}
        </div>
      </div>

      {/* Preview do Canvas com Recorte Transparente */}
      <div className="relative w-full h-44 bg-[#0A0A0A] rounded-xl overflow-hidden border border-[#353534] flex items-center justify-center">
        {cameraError ? (
          <div className="text-center p-4 text-rose-400 text-xs font-mono space-y-2">
            <p>{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-3 py-1.5 bg-[#FF9900] text-slate-950 font-bold rounded-lg hover:bg-[#ffaa2b] transition-all inline-flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>CONCEDER PERMISSÃO</span>
            </button>
          </div>
        ) : streamActive ? (
          <div className="relative w-full h-full bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:12px_12px]">
            <canvas ref={drawerCanvasRef} className="w-full h-full object-contain" />
            <div className="absolute top-2 right-2 bg-slate-900/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-[#FF9900] border border-[#353534]">
              {userPoseState.isCutoutActive ? 'CORPO ISOLADO (SOBREPOSIÇÃO 360°)' : 'OVERLAY CÂMERA COMPLETA'}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-2 text-slate-400 p-4">
            <Camera className="w-8 h-8 mx-auto text-[#FF9900] opacity-80" />
            <p className="text-xs font-mono">Iniciando captura da câmera do usuário...</p>
          </div>
        )}
      </div>

      {/* Toggle e Controles do Recorte / Chroma Key */}
      <div className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-xl border border-[#353534]">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#FF9900]" />
          <span className="text-xs font-mono font-semibold text-slate-200">Ativar Remoção de Fundo (Isolamento 3D):</span>
        </div>
        <button
          onClick={() => onPoseChange(prev => ({ ...prev, isCutoutActive: !prev.isCutoutActive }))}
          className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center ${
            userPoseState.isCutoutActive ? 'bg-[#FF9900] justify-end' : 'bg-[#353534] justify-start'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
        </button>
      </div>

      {userPoseState.isCutoutActive && (
        <div className="space-y-3 pt-1">
          {/* Seleção do Motor de Segmentação: IA MediaPipe vs Chroma Key */}
          <div className="p-3 bg-[#0A0A0A] rounded-xl border border-[#353534] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-300">
              <span className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#FF9900]" />
                <span>Motor de Remoção de Fundo:</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {userPoseState.segmentationEngine === 'chroma' ? 'CHROMA KEY' : isAiLoaded ? 'IA MEDIAPIPE ATIVA' : 'CARREGANDO IA...'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onPoseChange(prev => ({ ...prev, segmentationEngine: 'mediapipe' }))}
                className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all border flex items-center justify-center space-x-2 ${
                  userPoseState.segmentationEngine === 'mediapipe' || !userPoseState.segmentationEngine
                    ? 'bg-[#FF9900]/20 text-[#FF9900] border-[#FF9900]/60 shadow-md'
                    : 'bg-[#121212] text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>IA MediaPipe (Auto)</span>
              </button>

              <button
                onClick={() => onPoseChange(prev => ({ ...prev, segmentationEngine: 'chroma' }))}
                className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all border flex items-center justify-center space-x-2 ${
                  userPoseState.segmentationEngine === 'chroma'
                    ? 'bg-[#FF9900]/20 text-[#FF9900] border-[#FF9900]/60 shadow-md'
                    : 'bg-[#121212] text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Chroma Key (Cor)</span>
              </button>
            </div>
          </div>

          {/* Seleção de Modo de Chroma Key quando selecionado o motor de Cor */}
          {userPoseState.segmentationEngine === 'chroma' && (
            <div className="p-3 bg-[#0A0A0A] rounded-xl border border-[#353534] space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-mono font-semibold text-slate-300">
                <Palette className="w-3.5 h-3.5 text-[#FF9900]" />
                <span>Modo de Chroma Key:</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => onPoseChange(prev => ({ ...prev, chromaMode: 'green' }))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center justify-center space-x-1 ${
                    userPoseState.chromaMode === 'green' || !userPoseState.chromaMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md'
                      : 'bg-[#121212] text-slate-400 border-white/10 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Verde (Green)</span>
                </button>

                <button
                  onClick={() => onPoseChange(prev => ({ ...prev, chromaMode: 'blue' }))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center justify-center space-x-1 ${
                    userPoseState.chromaMode === 'blue'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-md'
                      : 'bg-[#121212] text-slate-400 border-white/10 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Azul (Blue)</span>
                </button>

                <button
                  onClick={() => onPoseChange(prev => ({ ...prev, chromaMode: 'custom' }))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center justify-center space-x-1 ${
                    userPoseState.chromaMode === 'custom'
                      ? 'bg-[#FF9900]/20 text-[#FF9900] border-[#FF9900]/60 shadow-md'
                      : 'bg-[#121212] text-slate-400 border-white/10 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#FF9900]" />
                  <span>Customizado</span>
                </button>

                <button
                  onClick={() => onPoseChange(prev => ({ ...prev, chromaMode: 'luma' }))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border flex items-center justify-center space-x-1 ${
                    userPoseState.chromaMode === 'luma'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-md'
                      : 'bg-[#121212] text-slate-400 border-white/10 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>Luminância</span>
                </button>
              </div>

              {/* Color Picker para Cor Customizada */}
              {userPoseState.chromaMode === 'custom' && (
                <div className="flex items-center justify-between pt-2 px-1">
                  <span className="text-[11px] font-mono text-slate-400">Cor do Fundo a Remover:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={userPoseState.chromaTargetColor || '#00FF00'}
                      onChange={e => onPoseChange(prev => ({ ...prev, chromaTargetColor: e.target.value }))}
                      className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-[#FF9900] uppercase font-bold">
                      {userPoseState.chromaTargetColor || '#00FF00'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sliders de Ajuste Fino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tolerância / Sensibilidade */}
            <div className="p-3 bg-[#0A0A0A] rounded-xl border border-[#353534] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-300">
                <span className="flex items-center space-x-1">
                  <Sliders className="w-3.5 h-3.5 text-[#FF9900]" />
                  <span>Tolerância de Cor:</span>
                </span>
                <span className="font-mono text-[#FF9900]">
                  {Math.round((userPoseState.chromaTolerance ?? 0.25) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.60"
                step="0.01"
                value={userPoseState.chromaTolerance ?? 0.25}
                onChange={e => onPoseChange(prev => ({ ...prev, chromaTolerance: parseFloat(e.target.value) }))}
                className="w-full accent-[#FF9900] cursor-pointer"
              />
            </div>

            {/* Suavização de Borda (Feathering) */}
            <div className="p-3 bg-[#0A0A0A] rounded-xl border border-[#353534] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-300">
                <span className="flex items-center space-x-1">
                  <Layers className="w-3.5 h-3.5 text-[#FF9900]" />
                  <span>Suavização de Borda:</span>
                </span>
                <span className="font-mono text-[#FF9900]">
                  {Math.round((userPoseState.feathering ?? 0.15) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.40"
                step="0.01"
                value={userPoseState.feathering ?? 0.15}
                onChange={e => onPoseChange(prev => ({ ...prev, feathering: parseFloat(e.target.value) }))}
                className="w-full accent-[#FF9900] cursor-pointer"
              />
            </div>

            {/* Supressão de Vazo (Spill Suppression) */}
            <div className="p-3 bg-[#0A0A0A] rounded-xl border border-[#353534] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-300">
                <span className="flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF9900]" />
                  <span>Remover Vazamento:</span>
                </span>
                <span className="font-mono text-[#FF9900]">
                  {Math.round((userPoseState.spillSuppression ?? 0.5) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={userPoseState.spillSuppression ?? 0.5}
                onChange={e => onPoseChange(prev => ({ ...prev, spillSuppression: parseFloat(e.target.value) }))}
                className="w-full accent-[#FF9900] cursor-pointer"
              />
            </div>

            {/* Opacidade do Corpo */}
            <div className="p-3 bg-[#0A0A0A] rounded-xl border border-[#353534] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-300">
                <span className="flex items-center space-x-1">
                  <Eye className="w-3.5 h-3.5 text-[#FF9900]" />
                  <span>Opacidade do Corpo:</span>
                </span>
                <span className="font-mono text-[#FF9900]">
                  {Math.round((userPoseState.bodyOpacity ?? 1.0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={userPoseState.bodyOpacity ?? 1.0}
                onChange={e => onPoseChange(prev => ({ ...prev, bodyOpacity: parseFloat(e.target.value) }))}
                className="w-full accent-[#FF9900] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
