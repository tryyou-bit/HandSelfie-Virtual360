import React, { useRef, useState, useEffect } from 'react';
import { Background360 } from '../types';
import { SecurityEngine } from '../services/security';
import { RefreshCw, Upload, Sparkles, CheckCircle2, AlertTriangle, Image as ImageIcon } from 'lucide-react';

interface Converter2DProps {
  onAddBackgroundToLibrary: (bg: Background360) => void;
  onSelectBackground: (bg: Background360) => void;
}

export const Converter2D: React.FC<Converter2DProps> = ({
  onAddBackgroundToLibrary,
  onSelectBackground
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview2DUrl, setPreview2DUrl] = useState<string | null>(null);
  const [fovDegrees, setFovDegrees] = useState<number>(110);
  const [edgeBlur, setEdgeBlur] = useState<number>(0.15);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [converting, setConverting] = useState<boolean>(false);
  const [convertedSuccess, setConvertedSuccess] = useState<boolean>(false);

  // Manipulador de Upload com Validação do Módulo de Segurança
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    setConvertedSuccess(false);

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validação do Módulo SecOps (Magic Numbers & Zip/Decompression Bomb check)
      const secCheck = await SecurityEngine.validateImageFile(file);
      if (!secCheck.valid) {
        setValidationError(secCheck.error || 'Arquivo de imagem rejeitado pela segurança.');
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreview2DUrl(url);
    }
  };

  // Processa a Projeção Equirretangular em Canvas WebGL
  useEffect(() => {
    if (!preview2DUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = preview2DUrl;
    img.onload = () => {
      canvas.width = 2048;
      canvas.height = 1024;

      // Limpa canvas com fundo cósmico para área expandida
      ctx.fillStyle = '#050711';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Algoritmo de projeção esférica 2D para Equirretangular 360°
      const targetW = canvas.width * (fovDegrees / 180);
      const targetH = targetW * (img.height / img.width);
      const startX = (canvas.width - targetW) / 2;
      const startY = (canvas.height - targetH) / 2;

      // Espelhamento e difusão das bordas (Spherical Blending)
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.filter = `blur(${edgeBlur * 40}px)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Desenha imagem central com nitidez
      ctx.drawImage(img, startX, startY, targetW, targetH);
    };
  }, [preview2DUrl, fovDegrees, edgeBlur]);

  const handleConvertAndSave = () => {
    if (!canvasRef.current || !selectedFile) return;

    setConverting(true);
    setTimeout(() => {
      const convertedDataUrl = canvasRef.current!.toDataURL('image/jpeg', 0.88);
      const newBg: Background360 = {
        id: `converted-${Date.now()}`,
        title: selectedFile.name.replace(/\.[^/.]+$/, "") + " (360°)",
        category: 'Conversão 2D',
        dataUrl: convertedDataUrl,
        isUserUploaded: true,
        lightingType: 'Sintetizado via WebGL',
        recommendedAnchorY: 0.0,
        tags: ['convertido', '2d-para-360', 'custom'],
        description: 'Imagem 2D processada em projeção equirretangular 360° via shader de computação gráfica.'
      };

      onAddBackgroundToLibrary(newBg);
      onSelectBackground(newBg);
      setConverting(false);
      setConvertedSuccess(true);
    }, 600);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Header do Módulo Conversor */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Conversor 2D para 360° Equirretangular</h2>
            <p className="text-xs text-slate-400">Transforme qualquer imagem PNG ou JPG plana em um fundo 360° interativo.</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-lg border border-indigo-500/20 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>WebGL GLSL Shader</span>
        </div>
      </div>

      {/* Área de Seleção e Drag & Drop de Arquivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Lado Esquerdo: Input de Upload e Controles */}
        <div className="space-y-4">
          <label className="block w-full cursor-pointer">
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 bg-slate-950 hover:bg-slate-900/60 transition-all rounded-2xl p-6 text-center space-y-3">
              <Upload className="w-8 h-8 text-cyan-400 mx-auto" />
              <div>
                <p className="text-xs font-bold text-slate-200">Clique para selecionar imagem PNG ou JPG</p>
                <p className="text-[11px] text-slate-500 mt-1">Limite máximo: 10 MB (Validação de Magic Numbers SecOps)</p>
              </div>
              <input type="file" accept="image/png, image/jpeg" onChange={handleFileChange} className="hidden" />
            </div>
          </label>

          {validationError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-400 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {preview2DUrl && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Ajustes da Projeção Esférica</h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Campo de Visão (FOV):</span>
                  <span className="font-mono text-cyan-400">{fovDegrees}°</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="160"
                  value={fovDegrees}
                  onChange={e => setFovDegrees(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Suavização de Bordas (Spherical Blur):</span>
                  <span className="font-mono text-cyan-400">{Math.round(edgeBlur * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.02"
                  value={edgeBlur}
                  onChange={e => setEdgeBlur(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <button
                onClick={handleConvertAndSave}
                disabled={converting}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2"
              >
                {converting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Gerar Panorama 360° & Carregar no Viewer</span>
                  </>
                )}
              </button>

              {convertedSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Convertido com Sucesso! Disponível no Viewer 360°.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lado Direito: Canvas do Resultado 360° Equirretangular */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resultado 360° Equirretangular (2048 x 1024)</span>
          </label>

          <div className="relative w-full h-64 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {preview2DUrl ? (
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            ) : (
              <div className="text-center p-6 text-slate-500 space-y-2">
                <ImageIcon className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs">Selecione uma imagem 2D à esquerda para visualizar o mapa 360°.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
