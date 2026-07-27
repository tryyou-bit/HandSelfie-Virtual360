import React, { useState } from 'react';
import { Background360 } from '../types';
import { analyzeBackground360WithGemini, GeminiAnalysisResult } from '../services/geminiService';
import { Library, Sparkles, Check, Info, Loader2, Tag, Sun, Compass } from 'lucide-react';

interface Library360Props {
  backgrounds: Background360[];
  selectedBackgroundId: string;
  onSelectBackground: (bg: Background360) => void;
  onUpdateBackgroundMetadata: (bgId: string, metadata: Partial<Background360>) => void;
}

export const Library360: React.FC<Library360Props> = ({
  backgrounds,
  selectedBackgroundId,
  onSelectBackground,
  onUpdateBackgroundMetadata
}) => {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [geminiResult, setGeminiResult] = useState<{ id: string; result: GeminiAnalysisResult } | null>(null);

  const handleAnalyzeWithGemini = async (bg: Background360) => {
    try {
      setAnalyzingId(bg.id);
      const analysis = await analyzeBackground360WithGemini(bg.dataUrl);
      
      onUpdateBackgroundMetadata(bg.id, {
        lightingType: analysis.lightingType,
        recommendedAnchorY: analysis.recommendedAnchorY,
        tags: analysis.tags,
        description: analysis.description
      });

      setGeminiResult({ id: bg.id, result: analysis });
    } catch (err) {
      console.error('Erro na análise:', err);
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Header da Biblioteca */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Biblioteca de Cenários 360°</h2>
            <p className="text-xs text-slate-400">Selecione cenários e analise com a IA Gemini 3.5 Flash para ancoragem otimizada.</p>
          </div>
        </div>

        <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
          {backgrounds.length} Cenários Disponíveis
        </span>
      </div>

      {/* Grid de Cenários 360° */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {backgrounds.map(bg => {
          const isSelected = bg.id === selectedBackgroundId;
          const isAnalyzing = analyzingId === bg.id;

          return (
            <div
              key={bg.id}
              className={`group relative bg-slate-950 rounded-2xl overflow-hidden border transition-all ${
                isSelected
                  ? 'border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Preview do Panorama 360° */}
              <div className="relative h-40 w-full overflow-hidden bg-slate-900">
                <img
                  src={bg.dataUrl}
                  alt={bg.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                <div className="absolute top-2 left-2 flex items-center space-x-1.5">
                  <span className="bg-slate-900/80 backdrop-blur-md text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700">
                    {bg.category}
                  </span>
                  {bg.isUserUploaded && (
                    <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded text-[10px] font-mono border border-cyan-500/30">
                      CUSTOM 2D
                    </span>
                  )}
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 bg-cyan-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 shadow-md">
                    <Check className="w-3 h-3" />
                    <span>EM USO</span>
                  </div>
                )}
              </div>

              {/* Informações e Ações do Card */}
              <div className="p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-100">{bg.title}</h3>

                {bg.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{bg.description}</p>
                )}

                {/* Badges de IA */}
                {bg.tags && (
                  <div className="flex flex-wrap gap-1">
                    {bg.tags.map((tag, idx) => (
                      <span key={idx} className="bg-slate-900 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => onSelectBackground(bg)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Cenário Ativo' : 'Carregar no 3D'}
                  </button>

                  <button
                    onClick={() => handleAnalyzeWithGemini(bg)}
                    disabled={isAnalyzing}
                    title="Analisar iluminação e pontos de ancoragem com Gemini 3.5 Flash"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span className="hidden sm:inline">Análise IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Resultado Detalhado do Gemini 3.5 Flash */}
      {geminiResult && (
        <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-3">
          <div className="flex items-center space-x-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Relatório de Iluminação e Ancoragem — Gemini 3.5 Flash</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-semibold block">Estilo de Iluminação:</span>
              <span className="text-cyan-300 font-bold">{geminiResult.result.lightingType}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-semibold block">Ancoragem Y Recomendada:</span>
              <span className="text-indigo-300 font-bold font-mono">{geminiResult.result.recommendedAnchorY}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-semibold block">Descrição Técnica:</span>
              <span className="text-slate-300">{geminiResult.result.description}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
