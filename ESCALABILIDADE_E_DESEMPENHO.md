# ESCALABILIDADE_E_DESEMPENHO.md

## Engenharia de Performance Client-Side & Computação Gráfica
**Projeto:** Portal360 AI Studio — Processamento de Mídia Client-Side & Engine 3D
**Autor:** Squad de Engenharia de Elite (Tech Lead, Graphics Engineer, Performance Specialist)

---

### 1. ÁRVORE DE DIRETÓRIOS E ESTRUTURA MODULAR (VITE + CODE SPLITTING)

A arquitetura do projeto adota uma estrutura em camadas com isolamento estrito de módulos. A divisão de código (*Code Splitting*) e o *Lazy Loading* garantem um tempo de carregamento inicial (*Time to Interactive* - TTI) inferior a **1.2 segundos**.

```
/
├── index.html                           # Entry point HTML com preconnects
├── package.json                         # Dependências otimizadas
├── vite.config.ts                       # Configuração com rollupOptions e manualChunks
├── src/
│   ├── main.tsx                         # Bootstrap da aplicação React 19
│   ├── App.tsx                          # Gerenciador de layouts e rotas
│   ├── index.css                        # Estilos globais (Tailwind CSS v4)
│   ├── types/                           # Definições de tipos TypeScript estritos
│   │   ├── camera.ts
│   │   ├── three.ts
│   │   ├── gemini.ts
│   │   └── firebase.ts
│   ├── core/                            # Módulos principais de processamento pesado
│   │   ├── vision/                      # Engine de visão computacional
│   │   │   ├── BodySegmenter.ts         # MediaPipe WASM TaskVision wrapper
│   │   │   └── AntiDebugWorker.ts       # Web Worker de proteção anti-debugging
│   │   ├── graphics/                    # Engine 3D e Shaders
│   │   │   ├── SceneManager.ts          # Gerenciador Three.js (Camera, Lights, Renderer)
│   │   │   ├── Panorama360Viewer.ts     # Esfera 360°, Mapeamento de Textura e Anchors
│   │   │   ├── Converter2DTo360.ts      # Converter de imagem 2D em Equirretangular via WebGL
│   │   │   └── shaders/                 # Shaders GLSL customizados
│   │   │       ├── Equirectangular.vert.glsl
│   │   │       ├── Equirectangular.frag.glsl
│   │   │       └── MaskBlend.frag.glsl
│   │   └── sensors/                     # Fusion de sensores móveis
│   │       └── GyroscopeTracker.ts      # Filtro de suavização Slerp / Low-pass
│   ├── services/                        # Serviços de dados e conectores
│   │   ├── ai/                          # Google AI Studio Gemini 3.5 Flash SDK
│   │   │   └── GeminiService.ts
│   │   └── firebase/                    # Conectores Auth e Storage
│   │       ├── firebaseConfig.ts
│   │       ├── authService.ts
│   │       └── storageService.ts
│   └── components/                      # Componentes UI funcionais e acessíveis
│       ├── camera/                      # Feed de câmera e controles de recorte
│       ├── viewer360/                   # Viewport 3D e controles de giroscópio
│       ├── converter/                   # Interface do conversor de imagens 2D
│       ├── ai/                          # Painel de análise de cenário via Gemini
│       ├── ui/                          # Botões, Modais, Badges com Lucide React
│       └── security/                    # Visualizador de Regras de Segurança e Status
```

#### Configuração de Split de Chunks no `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs em produção
        drop_debugger: false, // Preserva debugger customizado para armadilha anti-debug
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Separando Three.js do bundle principal
          'three-vendor': ['three'],
          // Separando SDKs pesados em chunks dinâmicos
          'genai-vendor': ['@google/genai'],
          'motion-vendor': ['motion'],
        }
      }
    }
  }
});
```

---

### 2. GERENCIAMENTO DE MEMÓRIA E CICLO DE VIDA WEBGL (GARBAGE COLLECTION)

Atualizar uma textura de vídeo a 60 FPS dentro de uma cena Three.js gera alto consumo de VRAM e alocações repetidas de memória se não for rigorosamente gerenciado. O acúmulo de objetos descartados aciona pausas imprevisíveis de *Garbage Collection* (GC Jitter), fazendo a taxa de quadros cair de 60 FPS para menos de 30 FPS.

#### A. Política Zero-Allocation no Loop de Renderização (`renderLoop`)
- NENHUM objeto (`THREE.Vector3`, `THREE.Quaternion`, `THREE.Matrix4`) pode ser instanciado (`new THREE.Object()`) dentro do loop de animação `requestAnimationFrame`.
- Todos os vetores auxiliares são alocados previamente como variáveis estáticas e reaproveitados via métodos `.set()`, `.copy()` ou `.identity()`.

#### B. Descarte Correto de Recursos GPU (Garbage Collection Manual)
Quando um cenário 360° é alterado ou um mapa de textura é atualizado, a memória da GPU deve ser liberada imediatamente:

```typescript
export class GraphicsMemoryManager {
  /**
   * Libera completamente todos os recursos da GPU vinculados a um nó da cena Three.js
   */
  public static disposeNode(node: THREE.Object3D): void {
    if (!node) return;

    node.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        // 1. Libera Geometria
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        // 2. Libera Materiais e Texturas
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => this.disposeMaterial(mat));
          } else {
            this.disposeMaterial(mesh.material);
          }
        }
      }
    });
  }

  private static disposeMaterial(material: THREE.Material): void {
    material.dispose();
    
    // Varre todas as propriedades do material em busca de texturas associadas
    for (const key of Object.keys(material)) {
      const value = (material as any)[key];
      if (value && typeof value === 'object' && value.isTexture) {
        const texture = value as THREE.Texture;
        texture.dispose();
      }
    }
  }
}
```

---

### 3. MATEMÁTICA DA CENA E FUSION DE SENSORES (GIROSCÓPIO SUAVIZADO)

Para que a rotação da câmera 3D responda aos movimentos físicos do smartphone do usuário sem tremor (jitter) nem sobressaltos que causem **motion sickness** (enjoo de movimento), implementamos um algoritmo de normalização de giroscópio com **Filtro Passa-Baixas** e **Interpolação Esférica (Slerp)** em quatérnios.

#### Algoritmo Matemático de Suavização Gyroscope Slerp:

$$\mathbf{q}_{\text{raw}} = \text{EulerToQuaternion}(\alpha, \beta, \gamma, \text{"YXZ"})$$

$$\mathbf{q}_{\text{target}} = \mathbf{q}_{\text{raw}} \times \mathbf{q}_{\text{orient}}$$

$$\mathbf{q}_{\text{smoothed}} = \text{Slerp}(\mathbf{q}_{\text{current}}, \mathbf{q}_{\text{target}}, \alpha_{\text{smoothing}})$$

#### Código TypeScript de Implementação do Tracker:

```typescript
import * as THREE from 'three';

export class SmoothGyroscopeTracker {
  private currentQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private targetQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private euler: THREE.Euler = new THREE.Euler();
  private orientQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private zee: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  
  // Fator de suavização (Alpha): 0.1 = ultra suave, 1.0 = instantâneo sem filtro
  private smoothingFactor: number = 0.12;
  private screenOrientationAngle: number = 0;

  constructor() {
    this.updateScreenOrientation();
    window.addEventListener('orientationchange', () => this.updateScreenOrientation());
  }

  private updateScreenOrientation(): void {
    this.screenOrientationAngle = (window.orientation || screen.orientation?.angle || 0) * (Math.PI / 180);
  }

  /**
   * Processa os eventos brutos de DeviceOrientation (alpha, beta, gamma)
   */
  public processDeviceOrientation(alpha: number | null, beta: number | null, gamma: number | null): void {
    if (alpha === null || beta === null || gamma === null) return;

    // Converter graus em radianos
    const alphaRad = alpha * (Math.PI / 180);
    const betaRad = beta * (Math.PI / 180);
    const gammaRad = gamma * (Math.PI / 180);

    // Ordem de rotação da câmera no espaço 3D é estritamente 'YXZ'
    this.euler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
    this.targetQuaternion.setFromEuler(this.euler);

    // Compensa a rotação do dispositivo (orientação da tela em retrato vs paisagem)
    this.orientQuaternion.setFromAxisAngle(this.zee, -this.screenOrientationAngle);
    this.targetQuaternion.multiply(this.orientQuaternion);
  }

  /**
   * Atualiza o estado da câmera no loop de renderização (chamado a 60 FPS)
   */
  public updateCameraRotation(camera: THREE.PerspectiveCamera): void {
    // Interpolação Esférica Linear (Slerp) para remover ruído de medição
    this.currentQuaternion.slerp(this.targetQuaternion, this.smoothingFactor);
    camera.quaternion.copy(this.currentQuaternion);
  }
}
```

---
