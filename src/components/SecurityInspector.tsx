import React, { useState } from 'react';
import { SecurityStatus } from '../types';
import { SecurityEngine } from '../services/security';
import { Shield, Cpu, Lock, FileCode, CheckCircle, Terminal, AlertOctagon, Bug, User, Camera, Bell, Key, Save } from 'lucide-react';

interface SecurityInspectorProps {
  status: SecurityStatus;
}

export const SecurityInspector: React.FC<SecurityInspectorProps> = ({ status }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'camera_defaults' | 'rules' | 'pipeline' | 'pentest'>('profile');
  
  // Profile state
  const [userName, setUserName] = useState<string>('Izidio Ribeiro Silva');
  const [userEmail, setUserEmail] = useState<string>('izidioribeirosilva@gmail.com');
  const [userRole, setUserRole] = useState<string>('Diretor de Fotografia 360°');
  const [defaultResolution, setDefaultResolution] = useState<string>('4K (3840x2160)');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const [testFile, setTestFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTestFile(file);
      const res = await SecurityEngine.validateImageFile(file);
      setTestResult(res);
    }
  };

  const triggerDebuggerTrap = () => {
    alert('Testando armadilha Anti-Debugging... Abra o DevTools (F12) para checar o bloqueio.');
    (function() {})['constructor']('debugger')();
  };

  return (
    <div className="bg-[#131313] border border-[#353534] rounded-2xl p-6 shadow-2xl space-y-6 text-slate-200 select-none">
      
      {/* Header da Página de Ajustes de Perfil & Configurações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#353534] gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF9900]/10 border border-[#FF9900]/30 flex items-center justify-center text-[#FF9900]">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Ajustes de Perfil & Configurações de Conta</h2>
            <p className="text-xs text-slate-400">Gerencie seu perfil de usuário, preferências da câmera 360° e parâmetros SecOps.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={triggerDebuggerTrap}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-all font-mono"
          >
            <Bug className="w-4 h-4" />
            <span>Anti-Debug Test</span>
          </button>
        </div>
      </div>

      {/* Navegação por Sub-Abas */}
      <div className="flex items-center space-x-2 border-b border-[#353534] pb-3 overflow-x-auto no-scrollbar font-mono text-xs">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'profile'
              ? 'bg-[#201f1f] text-[#FF9900] border border-[#FF9900]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Perfil do Usuário</span>
        </button>

        <button
          onClick={() => setActiveTab('camera_defaults')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'camera_defaults'
              ? 'bg-[#201f1f] text-[#FF9900] border border-[#FF9900]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Preferências da Câmera</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'rules'
              ? 'bg-[#201f1f] text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Regras Firebase Storage</span>
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'pipeline'
              ? 'bg-[#201f1f] text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Pipeline Zero-Trust</span>
        </button>

        <button
          onClick={() => setActiveTab('pentest')}
          className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'pentest'
              ? 'bg-[#201f1f] text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>Validador Pentest</span>
        </button>
      </div>

      {/* Conteúdo da Aba 1: PERFIL DO USUÁRIO */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="flex items-center space-x-4 p-4 bg-[#0A0A0A] rounded-xl border border-[#353534]">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF9900] to-yellow-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg">
              IS
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">{userName}</h3>
              <p className="text-xs text-slate-400">{userEmail}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-[#FF9900]/10 border border-[#FF9900]/30 text-[#FF9900] rounded text-[10px] font-mono font-bold">
                {userRole}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Nome de Exibição</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#353534] rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#FF9900]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">E-mail Cadastrado</label>
              <input
                type="email"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#353534] rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#FF9900]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Cargo / Função</label>
              <input
                type="text"
                value={userRole}
                onChange={e => setUserRole(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#353534] rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#FF9900]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Qualidade de Exportação Padrão</label>
              <select
                value={defaultResolution}
                onChange={e => setDefaultResolution(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#353534] rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#FF9900]"
              >
                <option value="4K (3840x2160)">4K Equirretangular (3840x2160)</option>
                <option value="8K (7680x4320)">8K Cinema Ultra-HD (7680x4320)</option>
                <option value="Full HD (1920x1080)">Full HD (1920x1080)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedSuccess ? (
              <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
                <CheckCircle className="w-4 h-4" />
                <span>Perfil atualizado com sucesso!</span>
              </span>
            ) : <div />}

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#FF9900] hover:bg-[#ffaa2b] text-slate-950 font-mono font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>SALVAR ALTERAÇÕES</span>
            </button>
          </div>
        </form>
      )}

      {/* Conteúdo da Aba 2: PREFERÊNCIAS DA CÂMERA */}
      {activeTab === 'camera_defaults' && (
        <div className="space-y-4 text-xs font-mono">
          <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#353534] space-y-3">
            <h3 className="font-bold text-slate-100 flex items-center space-x-2">
              <Camera className="w-4 h-4 text-[#FF9900]" />
              <span>Ajustes Padrão do Módulo de Captura</span>
            </h3>

            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#FF9900] w-4 h-4 rounded" />
                <span>Iniciar Câmera Automaticamente em Modo FRONT</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#FF9900] w-4 h-4 rounded" />
                <span>Ativar Recorte Corporal com MediaPipe IA ao abrir</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#FF9900] w-4 h-4 rounded" />
                <span>Suavização de Borda (Feathering 15%) em Tempo Real</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 3: REGRAS FIREBASE */}
      {activeTab === 'rules' && (
        <div className="bg-[#0A0A0A] p-4 rounded-xl border border-[#353534] space-y-3 font-mono text-xs text-slate-300 overflow-x-auto">
          <div className="flex items-center justify-between text-slate-400 border-b border-[#353534] pb-2">
            <span className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>storage.rules (Declarative Firebase Security Rules)</span>
            </span>
            <span className="text-emerald-400">rules_version = '2'</span>
          </div>

          <pre className="text-slate-300 leading-relaxed text-[11px]">
{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isValidImageUpload() {
      return request.resource != null
          && request.resource.size <= 10 * 1024 * 1024 // Max 10MB
          && (request.resource.contentType == 'image/png' || request.resource.contentType == 'image/jpeg');
    }

    match /users/{userId}/backgrounds360/{fileName} {
      allow read: if isOwner(userId) || resource.metadata.isPublic == 'true';
      allow create, update: if isOwner(userId) && isValidImageUpload();
      allow delete: if isOwner(userId);
    }
  }
}`}
          </pre>
        </div>
      )}

      {/* Conteúdo da Aba 4: PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="bg-[#0A0A0A] p-4 rounded-xl border border-[#353534] space-y-4 text-xs">
          <h3 className="font-bold text-slate-200 flex items-center space-x-2 font-mono">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Mapeamento do Pipeline de Dados em Tempo Real (60 FPS)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#131313] rounded-lg border border-[#353534] space-y-1">
              <span className="text-[#FF9900] font-bold block">1. Camera Input (HD Stream):</span>
              <p className="text-slate-400">Captura a 1280x720 60 FPS com validação de hardware e dispositivo físico.</p>
            </div>

            <div className="p-3 bg-[#131313] rounded-lg border border-[#353534] space-y-1">
              <span className="text-indigo-400 font-bold block">2. MediaPipe TaskVision (WASM):</span>
              <p className="text-slate-400">Geração de máscara alfa em Zero-Copy via ImageBitmap e instruções SIMD128.</p>
            </div>

            <div className="p-3 bg-[#131313] rounded-lg border border-[#353534] space-y-1">
              <span className="text-emerald-400 font-bold block">3. Three.js WebGL Blend:</span>
              <p className="text-slate-400">Projeção do corpo isolado sobre a esfera 360° em tempo real via Fragment Shader.</p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 5: PENTEST */}
      {activeTab === 'pentest' && (
        <div className="bg-[#0A0A0A] p-4 rounded-xl border border-[#353534] space-y-4 text-xs">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-200 font-mono">Testador de Sanidade de Cabeçalhos e Magic Numbers</h3>
            <p className="text-slate-400">Faça upload de qualquer arquivo para testar a inspecção defensiva contra Zip Bombs e Imagens Políglotas.</p>
          </div>

          <label className="block cursor-pointer">
            <div className="p-4 border border-[#353534] hover:border-[#FF9900] bg-[#131313] rounded-xl text-center space-y-2 transition-colors">
              <p className="text-slate-300 font-medium font-mono">Selecione um arquivo de imagem para testar</p>
              <input type="file" onChange={handleTestImageFile} className="hidden" />
            </div>
          </label>

          {testFile && testResult && (
            <div className={`p-3 rounded-xl border flex items-center space-x-2 ${
              testResult.valid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>
                {testResult.valid
                  ? `Arquivo [${testFile.name}] APROVADO: Magic Numbers válidos (PNG/JPEG) e tamanho seguro (${(testFile.size / 1024 / 1024).toFixed(2)} MB).`
                  : `REJEITADO: ${testResult.error}`}
              </span>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
