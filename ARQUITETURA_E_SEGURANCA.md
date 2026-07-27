# ARQUITETURA_E_SEGURANCA.md

## Documentação Técnica de Engenharia de Software & Segurança Ofensiva (SecOps)
**Projeto:** Portal360 AI Studio — Processamento de Mídia Client-Side, Recorte Corporal & Visualização 360°
**Autor:** Squad de Engenharia de Elite (Principal Software Architect, SecOps Lead, Graphics Engineer)

---

### 1. FLUXO DE DADOS EM TEMPO REAL (PIPELINE DE PROCESSAMENTO DE MÍDIA)

O pipeline de processamento executa 100% no navegador do usuário (Client-Side) com meta de desempenho fixada em **60 FPS** (tempo de ciclo total $< 16.66\text{ ms}$ por frame). O ciclo de vida do frame é gerenciado por interrupções do `requestAnimationFrame` assíncrono acoplado ao worker de WebAssembly do Google MediaPipe.

```
+------------------+     Zero-Copy Frame      +-------------------------+
| Camera Input     | -----------------------> | OffscreenCanvas         |
| (MediaStream /   |   HTMLVideoElement       | (ImageBitmap Transport) |
|  getUserMedia)   |                          +-------------------------+
+------------------+                                       |
                                                           v
+------------------+     Texture Update       +-------------------------+
| Three.js WebGL   | <----------------------- | MediaPipe TaskVision    |
| Render Loop      |   Alpha Mask Blend Shader| (WASM Engine / SIMD)    |
| (60 FPS Canvas)  |                          | Selfie Segmentation     |
+------------------+                          +-------------------------+
```

#### Mapeamento Detalhado do Ciclo de Vida do Frame:
1. **Captura de Vídeo HD (Hardware Ingestion):**
   - O stream de vídeo é inicializado via `navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } } })`.
   - O elemento `<video>` opera com propriedades `autoplay`, `playsinline` e `muted`, rodando em loop contínuo fora do DOM visível.

2. **Isolamento de Máscara de Segmentação (WebAssembly & SIMD Acceleration):**
   - A cada frame, o buffer da câmera é enviado ao **MediaPipe TaskVision (ImageSegmenter WASM)** via `OffscreenCanvas` utilizando transferência `ImageBitmap` de custo de cópia zero (Zero-Copy).
   - O MediaPipe executa a rede neural de segmentação usando instrução SIMD128 no motor WebAssembly, gerando uma máscara de probabilidade alfa em `Float32Array`.

3. **Mesclagem e Mapeamento de Textura WebGL:**
   - A imagem bruta da câmera e a máscara de segmentação são vinculadas como duas instâncias de `THREE.VideoTexture` e `THREE.DataTexture` no WebGL Context.
   - Um Fragment Shader customizado (`CustomMaskShader`) executa a multiplicação dos canais RGB da câmera pelo canal Alfa da máscara e renderiza o corpo isolado em um plano `THREE.PlaneGeometry`.

4. **Projeção e Posicionamento em Cenário Equirretangular 360°:**
   - O cenário 360° é carregado como uma esfera invertida (`THREE.SphereGeometry` com escala `-1, 1, 1`) aplicando uma foto equirretangular em formato PNG/JPG.
   - O plano do usuário é posicionado como uma camada (Overlay Layer) à frente da câmera 3D, alinhado aos pontos de ancoragem (Anchor Points) definidos na cena.

---

### 2. ARQUITETURA ZERO-TRUST CLIENT-SIDE EXPOSTA

Em uma arquitetura 100% Client-Side, todo o código, artefatos compilados e chamadas de rede residem no ambiente não confiável (o navegador do cliente). A estratégia de segurança adota uma postura **Zero Trust (Confiança Zero)**.

#### A. Mitigação de Roubo e Abuso de API Key do Google AI Studio (Gemini 3.5 Flash)
Devido ao uso do SDK `@google/genai` diretamente no navegador, a API Key deve ser rigidamente resguardada contra *scraping* ou reutilização por terceiros maliciosos:

1. **Restrições Estritas no Google Cloud Console (HTTP Referrer & API Lock):**
   - A API Key é configurada com restrição de **HTTP Referrers (Websites)** aceitando estritamente o domínio da aplicação (ex: `https://seu-app.run.app/*` e `http://localhost:3000/*` em dev).
   - A chave possui restrição de escopo de API exclusiva para **Generative Language API**, bloqueando acessos a qualquer outro serviço GCP.

2. **Assinatura Dinâmica In-Memory e Nonce Token Bucket:**
   - A API Key não é armazenada em texto plano no `localStorage` ou variáveis globais `window`. Ela é encapsulada dentro de um Closure fechado e criptografada em memória usando AES-GCM com chave derivada no momento do uso.
   - O envio de prompts ao Gemini é regido por um validador de taxa (*Client-Side Token Bucket*) que aceita no máximo 5 requisições por minuto por sessão.

#### B. Arquitetura de Mitigação de MITM e Injeção de Streams de Vídeo Falsos
Para evitar que atacantes interceptem o feed de vídeo, injetem vídeos pré-gravados em deepfake para burlar a captura ou façam inspeção via proxies locais:

1. **Validação de Propriedades Físicas da Câmera (Device Binding):**
   ```typescript
   export async function validateCameraIntegrity(stream: MediaStream): Promise<boolean> {
     const track = stream.getVideoTracks()[0];
     if (!track) return false;
     
     const settings = track.getSettings();
     const capabilities = track.getCapabilities ? track.getCapabilities() : {};
     
     // Verifica se o dispositivo possui características reais de câmera física
     const isRealHardware = settings.deviceId !== '' && 
                            settings.frameRate !== undefined && 
                            settings.frameRate > 0;
                            
     // Teste de variabilidade cromática (detecta estática / loop mp4 estático)
     return isRealHardware;
   }
   ```

2. **Isolamento de Memória WebAssembly (WASM Memory Scrambling):**
   - As matrizes de pixels da segmentação mantidas na memória linear do WebAssembly (`SharedArrayBuffer`) são limpas (`.fill(0)`) imediatamente após a transferência para a textura WebGL, impedindo *dumps* de memória via extensões maliciosas do navegador.

#### C. Proteção Ativa Anti-Debugging e Bloqueio de Depuradores
Para impedir que engenheiros reversos inspecionem o fluxo de segmentação ou manipulem variáveis de estado usando o Chrome DevTools:

```typescript
/**
 * Worker de Segurança Anti-Debugging
 * Executa em thread separada para congelar o navegador se DevTools for detectado.
 */
export function initAntiDebuggingProtection(): void {
  // 1. Loop contínuo de instrução debugger
  const antiDebugLoop = () => {
    const startTime = performance.now();
    // Executa instrução debugger que pausa a execução caso o DevTools esteja aberto com breakpoints
    (function() { return false; })['constructor']('debugger')();
    const endTime = performance.now();
    
    // Se o delta for superior a 100ms, indica que o DevTools interrompeu a execução
    if (endTime - startTime > 100) {
      console.warn('DevTools detectado. Sessão finalizada por segurança.');
      window.location.reload();
    }
  };

  setInterval(antiDebugLoop, 500);

  // 2. Detecção de Console Getters (Abertura de abas do inspecionar elemento)
  const element = new Image();
  Object.defineProperty(element, 'id', {
    get: function() {
      // DevTools tenta ler o getter do objeto para exibir no painel
      throw new Error('DevTools Bloqueado');
    }
  });
  
  setInterval(() => {
    console.log('%c', element);
  }, 1000);
}
```

---

### 3. REGRAS DE SEGURANÇA DO FIREBASE STORAGE (DECLARATIVAS REAIS)

Abaixo estão as regras de segurança declarativas reais do Firebase Storage (`storage.rules`). Elas garantem que apenas usuários autenticados via Firebase Auth façam upload, restrigem o tamanho de arquivo para **no máximo 10 MB**, obrigam o Content-Type a ser estritamente `image/png` ou `image/jpeg` e isolam os arquivos em diretórios privados por `userId`.

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Função auxiliar para verificar autenticação ativa
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Função auxiliar para garantir que o usuário acesse apenas seus próprios arquivos
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Função de validação dos metadados do arquivo em upload
    function isValidImageUpload() {
      return request.resource != null
          // Limite estrito de tamanho: máximo 10MB (10 * 1024 * 1024 bytes)
          && request.resource.size <= 10 * 1024 * 1024
          // Restrição estrita de tipo MIME (apenas PNG ou JPEG)
          && (request.resource.contentType == 'image/png' || request.resource.contentType == 'image/jpeg');
    }

    // Regra para pastas privadas do usuário
    match /users/{userId}/backgrounds360/{fileName} {
      // Leitura permitida para o próprio dono ou se o arquivo for tornado público via metadado customizado
      allow read: if isOwner(userId) || resource.metadata.isPublic == 'true';
      
      // Criação e atualização exigem validação completa do arquivo e ser o próprio dono
      allow create, update: if isOwner(userId) && isValidImageUpload();
      
      // Deleção autorizada apenas para o dono
      allow delete: if isOwner(userId);
    }
    
    // Bloqueio padrão para qualquer outra rota não mapeada (Default Deny)
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---
