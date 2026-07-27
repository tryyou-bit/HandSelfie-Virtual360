# CONVERSOR_IA_E_VULNERABILIDADES.md

## Conversor WebGL GLSL, Inteligência Artificial Gemini 3.5 & Pentesting
**Projeto:** Portal360 AI Studio — Processamento de Mídia Client-Side & Defesa Cibernética
**Autor:** Squad de Engenharia de Elite (SecOps Lead, Graphics Specialist, AI Engineer)

---

### 1. CONVERSOR 2D PARA 360° EQUIRRETANGULAR VIA WEBGL/SHADERS

Converter uma imagem 2D plana em uma projeção equirretangular panorâmica 360° na CPU gera engasgos graves na thread principal. A conversão é executada na GPU via WebGL com um Fragment Shader GLSL customizado que remapeia as coordenadas $U, V$ em coordenadas esféricas $(\theta, \phi)$.

$$\theta = (U - 0.5) \times 2\pi, \quad \phi = (V - 0.5) \times \pi$$

$$\mathbf{d} = (\sin\theta \cdot \cos\phi, \; \sin\phi, \; \cos\theta \cdot \cos\phi)$$

#### A. Fragment Shader GLSL (`EquirectangularConverter.frag`):
```glsl
precision highp float;

varying vec2 vUv;
uniform sampler2D uSourceTexture;
uniform float uFovDegrees;
uniform float uAspect;
uniform float uBlurEdge;

#define PI 3.14159265359

void main() {
    // 1. Converter coordenada UV equirretangular [0,1] em ângulos longitudinais e latitudinais
    float longitude = (vUv.x - 0.5) * 2.0 * PI; // -PI a +PI
    float latitude = (vUv.y - 0.5) * PI;        // -PI/2 a +PI/2

    // 2. Calcular vetor de direção 3D no espaço cartesiano da esfera
    vec3 dir = vec3(
        sin(longitude) * cos(latitude),
        sin(latitude),
        cos(longitude) * cos(latitude)
    );

    // 3. Projetar vetor de direção na janela da imagem 2D plana
    float fovRad = uFovDegrees * (PI / 180.0);
    float focalLength = 1.0 / tan(fovRad * 0.5);

    // Projetar a coordenada planar Z
    if (dir.z > 0.0) {
        vec2 planarUv = vec2(dir.x, dir.y) * (focalLength / dir.z);
        planarUv.x /= uAspect;

        // Converter de coordenadas centralizadas [-1, 1] para UV [0, 1]
        vec2 texUv = planarUv * 0.5 + vec2(0.5);

        // Checar se a coordenada cai dentro do campo da imagem 2D fonte
        if (texUv.x >= 0.0 && texUv.x <= 1.0 && texUv.y >= 0.0 && texUv.y <= 1.0) {
            vec4 color = texture2D(uSourceTexture, texUv);
            
            // Suavização das bordas para mesclagem limpa no fundo equirretangular
            float distFromEdge = min(min(texUv.x, 1.0 - texUv.x), min(texUv.y, 1.0 - texUv.y));
            float edgeAlpha = smoothstep(0.0, uBlurEdge, distFromEdge);
            
            gl_FragColor = vec4(color.rgb, edgeAlpha);
            return;
        }
    }

    // Cor de preenchimento para regiões fora do campo da imagem 2D (fundo expansível)
    gl_FragColor = vec4(0.05, 0.07, 0.1, 1.0);
}
```

---

### 2. INTEGRAÇÃO COM GEMINI 3.5 FLASH VIA SDK CLIENT-SIDE (`@google/genai`)

O SDK `@google/genai` é utilizado para catalogar, sugerir pontos de ancoragem e enriqecer metadados do cenário 360° gerado pelo usuário.

```typescript
import { GoogleGenAI, Type } from '@google/genai';

export interface ScenarioMetadata {
  title: string;
  lightingType: string;
  recommendedAnchorY: number;
  tags: string[];
  description: string;
}

export class GeminiScenarioAnalyzer {
  private ai: GoogleGenAI;

  constructor() {
    // Inicialização segura utilizando a chave exposta com restrição no Cloud Console
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Analisa a imagem equirretangular convertida e gera metadados em formato JSON estrito
   */
  public async analyzeEquirectangularBackground(base64Image: string): Promise<ScenarioMetadata> {
    const model = 'gemini-2.5-flash'; // Modelo ultrarrápido para imagens e áudio
    
    // Schema de saída estruturada para garantir parse JSON perfeito
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título sugestivo do cenário' },
        lightingType: { type: Type.STRING, description: 'Tipo de iluminação (Ex: Natural, Néon, Quente, Sombra)' },
        recommendedAnchorY: { type: Type.NUMBER, description: 'Altura recomendada para o avatar (-1.0 a 1.0)' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tags de categoria do ambiente' },
        description: { type: Type.STRING, description: 'Descrição rica para acessibilidade de tela' }
      },
      required: ['title', 'lightingType', 'recommendedAnchorY', 'tags', 'description']
    };

    const prompt = `Você é um Arquiteto de Iluminação e Computação Gráfica. Analise este cenário panorâmico 360 graus. 
Identifique a iluminação dominante, determine a posição vertical Y adequada para fixar o recorte do usuário e retorne a descrição técnica.`;

    const imagePart = {
      inlineData: {
        data: base64Image.replace(/^data:image\/(png|jpeg);base64,/, ''),
        mimeType: 'image/jpeg'
      }
    };

    const response = await this.ai.models.generateContent({
      model,
      contents: [prompt, imagePart],
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2 // Baixa temperatura para dados determinísticos
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error('Falha ao obter resposta do Gemini');

    return JSON.parse(resultText) as ScenarioMetadata;
  }
}
```

---

### 3. PLANO DE TESTES DE VULNERABILIDADE E DEFESA CIBERNÉTICA (PENTESTING)

#### A. Mitigação de Zip Bombs, Decompression Bombs e Imagens Políglotas
Atacantes podem enviar arquivos maliciosos compactados com dimensões infladas (ex: imagem PNG de $50.000 \times 50.000$ pixels com peso comprimido de apenas 500 KB) para causar estouro da memória heap V8 (*Out of Memory*) e crashar a aba do usuário.

```typescript
export class ImageSecurityValidator {
  private static MAX_PIXEL_DIMENSION = 8192; // Resolução máxima 8K por lado
  private static MAX_TOTAL_PIXELS = 8192 * 8192; // ~67 Megapixels

  /**
   * Validação defensiva rápida inspecionando diretamente os bytes do cabeçalho sem carregar o Canvas na memória
   */
  public static async validateFileHeader(file: File): Promise<boolean> {
    const buffer = await file.slice(0, 32).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Validação de Magic Numbers em hexadecimal
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;

    if (!isPNG && !isJPEG) {
      throw new Error('Assinatura de arquivo inválida (Tentativa de injeção políglota).');
    }

    // 2. Extração de dimensões direto do IHDR chunk sem renderizar o bitmap
    if (isPNG) {
      const view = new DataView(buffer);
      const width = view.getUint32(16, false);  // Offset 16 no IHDR do PNG
      const height = view.getUint32(20, false); // Offset 20 no IHDR do PNG

      if (width > this.MAX_PIXEL_DIMENSION || height > this.MAX_PIXEL_DIMENSION || (width * height) > this.MAX_TOTAL_PIXELS) {
        throw new Error(`Ataque de descompressão bloqueado: Dimensões excedem o limite seguro (${width}x${height}).`);
      }
    }

    return true;
  }
}
```

#### B. Engenharia Reversa Preventiva (Ofuscação Avançada no Vite)
Para dificultar a clonagem de código-fonte e extração da lógica de renderização, o build de produção configura transformações em nível de AST via Terser:
- **String Array Encoding:** Codifica todas as strings constantes em arrays binários ofuscados.
- **Control Flow Flattening:** Altera a estrutura dos blocos `if/else` e `loops` para desviar a análise de descompiladores.
- **Identificadores Mangle:** Substitui nomes de funções e variáveis por cadeias não inteligíveis de caractere único.

#### C. Limitação de Cota Client-Side (Rate Limiting via Sliding Window)
Para evitar o consumo excessivo da API Key do Gemini por scripts automatizados na máquina do cliente:

```typescript
export class ClientRateLimiter {
  private static STORAGE_KEY = 'portal360_gemini_quota';
  private static MAX_CALLS_PER_WINDOW = 5;
  private static WINDOW_MS = 60 * 1000; // Janela de 1 minuto

  public static checkQuotaOrThrow(): void {
    const now = Date.now();
    const rawData = localStorage.getItem(this.STORAGE_KEY);
    let timestamps: number[] = rawData ? JSON.parse(rawData) : [];

    // Limpa registros anteriores fora da janela atual de 1 minuto
    timestamps = timestamps.filter(t => now - t < this.WINDOW_MS);

    if (timestamps.length >= this.MAX_CALLS_PER_WINDOW) {
      const timeToWait = Math.ceil((this.WINDOW_MS - (now - timestamps[0])) / 1000);
      throw new Error(`Limite de requisições à IA excedido. Aguarde ${timeToWait} segundos.`);
    }

    timestamps.push(now);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(timestamps));
  }
}
```

---
