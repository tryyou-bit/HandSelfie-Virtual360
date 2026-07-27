import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Background360, AnchorPoint, UserPoseState } from '../types';
import { SmoothGyroscopeTracker } from '../core/sensors/GyroscopeTracker';

interface Panorama360ViewerProps {
  currentBackground: Background360;
  userPoseState: UserPoseState;
  onPoseChange: (updater: (prev: UserPoseState) => UserPoseState) => void;
  userCameraCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  anchors: AnchorPoint[];
}

export const Panorama360Viewer: React.FC<Panorama360ViewerProps> = ({
  currentBackground,
  userPoseState,
  onPoseChange,
  userCameraCanvasRef,
  anchors
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereMeshRef = useRef<THREE.Mesh | null>(null);
  const bodyOverlayMeshRef = useRef<THREE.Mesh | null>(null);
  const bodyTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const gyroTrackerRef = useRef<SmoothGyroscopeTracker | null>(null);

  const [gyroActive, setGyroActive] = useState<boolean>(false);
  
  // Angle tracking in refs for 60 FPS zero-lag mouse/touch interaction
  const lonRef = useRef<number>(0);
  const latRef = useRef<number>(0);
  const targetLonRef = useRef<number>(0);
  const targetLatRef = useRef<number>(0);

  const velocityXRef = useRef<number>(0);
  const velocityYRef = useRef<number>(0);

  const isPointerDownRef = useRef<boolean>(false);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);

  const [clickIndicator, setClickIndicator] = useState<{ x: number; y: number } | null>(null);

  // Inicialização da Cena Three.js WebGL
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Cena, Câmera e Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0.1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // 2. Esfera Invertida 360° (Equirretangular)
    const sphereGeometry = new THREE.SphereGeometry(500, 60, 40);
    sphereGeometry.scale(-1, 1, 1); // Inverte os vértices para visualização interna

    const textureLoader = new THREE.TextureLoader();
    const bgTexture = textureLoader.load(currentBackground.dataUrl);
    bgTexture.colorSpace = THREE.SRGBColorSpace;

    const sphereMaterial = new THREE.MeshBasicMaterial({ map: bgTexture });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphereMesh);
    sphereMeshRef.current = sphereMesh;

    scene.add(camera);

    // 3. Plano Overlay para Recorte Corporal da Câmera (Shader Material Customizado com Anti-Fringing & Guided Filter GPU)
    const bodyGeometry = new THREE.PlaneGeometry(16, 24);
    let bodyTexture: THREE.CanvasTexture;

    if (userCameraCanvasRef.current) {
      bodyTexture = new THREE.CanvasTexture(userCameraCanvasRef.current);
    } else {
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 256;
      dummyCanvas.height = 256;
      bodyTexture = new THREE.CanvasTexture(dummyCanvas);
    }
    bodyTexture.colorSpace = THREE.SRGBColorSpace;
    bodyTexture.minFilter = THREE.LinearFilter;
    bodyTexture.magFilter = THREE.LinearFilter;
    bodyTexture.generateMipmaps = false;
    bodyTextureRef.current = bodyTexture;

    const bodyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: bodyTexture },
        uOpacity: { value: userPoseState.bodyOpacity },
        uResolution: {
          value: new THREE.Vector2(
            userCameraCanvasRef.current?.width || 1280,
            userCameraCanvasRef.current?.height || 720
          )
        }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uOpacity;
        uniform vec2 uResolution;
        varying vec2 vUv;

        void main() {
          vec2 texel = 1.0 / uResolution;
          vec4 center = texture2D(tDiffuse, vUv);

          if (center.a < 0.0005) {
            discard;
          }

          // --- OPÇÃO A: MATTE CHOKER REFORÇADO (+50% DE INTENSIDADE MORFOLÓGICA GPU 5x5) ---
          float minAlpha = 1.0;
          float maxAlpha = 0.0;
          float alphaSum = 0.0;
          float weightSum = 0.0;

          vec3 innerOpaqueColor = center.rgb;
          float highestAlphaFound = center.a;
          float innerLumaSum = 0.0;
          float innerOpaqueCount = 0.0;

          // Raio estendido em +50% no espaço de texel para englobar franjas mais distantes
          vec2 stepTexel = texel * 1.5;

          for (int x = -2; x <= 2; x++) {
            for (int y = -2; y <= 2; y++) {
              vec2 offset = vec2(float(x), float(y)) * stepTexel;
              vec4 sampleCol = texture2D(tDiffuse, vUv + offset);

              float r2 = float(x*x + y*y);
              float w = exp(-r2 / 3.0);

              alphaSum += sampleCol.a * w;
              weightSum += w;

              minAlpha = min(minAlpha, sampleCol.a);
              maxAlpha = max(maxAlpha, sampleCol.a);

              if (sampleCol.a > highestAlphaFound) {
                highestAlphaFound = sampleCol.a;
                innerOpaqueColor = sampleCol.rgb;
              }

              if (sampleCol.a > 0.70) {
                float luma = dot(sampleCol.rgb, vec3(0.299, 0.587, 0.114));
                innerLumaSum += luma;
                innerOpaqueCount += 1.0;
              }
            }
          }

          float avgAlpha = alphaSum / weightSum;

          // Operação Matte Choke Reforçada (+50% aproximação do minAlpha para ejetar franjas)
          float chokedAlpha = mix(minAlpha, avgAlpha, 0.35);

          // Suavização Sigmoide de Borda Mais Severa (Corte de Borda 0.22 a 0.75)
          float refinedAlpha = smoothstep(0.22, 0.75, chokedAlpha);

          // --- OPÇÃO B: DESCONTAMINAÇÃO DE COR E LUMINÂNCIA REFORÇADA (+50%) ---
          vec3 finalRgb = center.rgb;

          if (refinedAlpha > 0.001 && refinedAlpha < 0.98) {
            // 1. Transferência de Cromaticidade (+50% Força de Descontaminação de Spill)
            float decontamFactor = pow(1.0 - refinedAlpha, 0.9);
            vec3 decontaminatedColor = mix(center.rgb, innerOpaqueColor, clamp(decontamFactor * 1.38, 0.0, 1.0));

            // 2. Normalização de Luminância Mais Agressiva nas Bordas para Anular Halos Claros
            if (innerOpaqueCount > 0.5) {
              float targetLuma = innerLumaSum / innerOpaqueCount;
              float currentLuma = dot(decontaminatedColor, vec3(0.299, 0.587, 0.114));

              if (currentLuma > targetLuma * 1.02) {
                float lumaCorrection = targetLuma / max(0.01, currentLuma);
                decontaminatedColor *= mix(1.0, lumaCorrection, 0.95);
              }
            }

            finalRgb = decontaminatedColor;
          }

          float finalAlpha = refinedAlpha * uOpacity;

          if (finalAlpha < 0.005) {
            discard;
          }

          gl_FragColor = vec4(finalRgb, finalAlpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.renderOrder = 999;
    bodyMesh.position.set(userPoseState.positionX, userPoseState.positionY, -25);
    camera.add(bodyMesh);
    bodyOverlayMeshRef.current = bodyMesh;

    // 4. Tracker de Giroscópio
    const gyroTracker = new SmoothGyroscopeTracker();
    gyroTrackerRef.current = gyroTracker;

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        setGyroActive(true);
        gyroTracker.processDeviceOrientation(event.alpha, event.beta, event.gamma);
      }
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation);

    // 5. Loop de Renderização a 60 FPS
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Atualiza textura do corpo se canvas estiver ativo
      if (userCameraCanvasRef.current && userCameraCanvasRef.current.width > 0) {
        if (!bodyTextureRef.current || bodyTextureRef.current.image !== userCameraCanvasRef.current) {
          if (bodyTextureRef.current) bodyTextureRef.current.dispose();
          const newTex = new THREE.CanvasTexture(userCameraCanvasRef.current);
          newTex.colorSpace = THREE.SRGBColorSpace;
          newTex.minFilter = THREE.LinearFilter;
          newTex.magFilter = THREE.LinearFilter;
          newTex.generateMipmaps = false;
          bodyTextureRef.current = newTex;
          if (bodyOverlayMeshRef.current) {
            const mat = bodyOverlayMeshRef.current.material as THREE.ShaderMaterial;
            if (mat && mat.uniforms) {
              if (mat.uniforms.tDiffuse) mat.uniforms.tDiffuse.value = newTex;
              if (mat.uniforms.uResolution) {
                mat.uniforms.uResolution.value.set(
                  userCameraCanvasRef.current.width || 1280,
                  userCameraCanvasRef.current.height || 720
                );
              }
              mat.needsUpdate = true;
            }
          }
        } else if (bodyTextureRef.current) {
          bodyTextureRef.current.needsUpdate = true;
        }
      }

      // Aplicação de rotação do giroscópio ou controle por mouse/touch
      if (gyroActive && cameraRef.current) {
        gyroTracker.updateCameraRotation(cameraRef.current);
      } else if (cameraRef.current) {
        // Inertia decay logic when not holding pointer
        if (!isPointerDownRef.current) {
          targetLonRef.current += velocityXRef.current;
          targetLatRef.current += velocityYRef.current;
          
          velocityXRef.current *= 0.92; // Friction decay
          velocityYRef.current *= 0.92;
        }

        // Clamp latitude to avoid camera flip
        targetLatRef.current = Math.max(-85, Math.min(85, targetLatRef.current));

        // Smooth interpolation (lerp) for smooth camera preview
        lonRef.current += (targetLonRef.current - lonRef.current) * 0.15;
        latRef.current += (targetLatRef.current - latRef.current) * 0.15;

        // Cálculo manual por ângulos longitude e latitude
        const phi = THREE.MathUtils.degToRad(90 - latRef.current);
        const theta = THREE.MathUtils.degToRad(lonRef.current);

        const targetX = 500 * Math.sin(phi) * Math.cos(theta);
        const targetY = 500 * Math.cos(phi);
        const targetZ = 500 * Math.sin(phi) * Math.sin(theta);

        cameraRef.current.lookAt(targetX, targetY, targetZ);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const newW = mountRef.current.clientWidth;
      const newH = mountRef.current.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      window.removeEventListener('resize', handleResize);

      // Descarte manual de memória GPU
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      bgTexture.dispose();
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      bodyTexture.dispose();
      renderer.dispose();
    };
  }, [currentBackground.id]);

  // Atualiza a textura da esfera ao mudar de fundo 360°
  useEffect(() => {
    if (!sphereMeshRef.current) return;
    const loader = new THREE.TextureLoader();
    loader.load(currentBackground.dataUrl, (newTexture) => {
      newTexture.colorSpace = THREE.SRGBColorSpace;
      if (sphereMeshRef.current) {
        const mat = sphereMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.map = newTexture;
        mat.needsUpdate = true;
      }
    });
  }, [currentBackground.dataUrl]);

  // Atualiza escala, posição e opacidade do corpo isolado
  useEffect(() => {
    if (!bodyOverlayMeshRef.current) return;
    bodyOverlayMeshRef.current.scale.set(userPoseState.bodyScale, userPoseState.bodyScale, 1);
    
    // Alinha com o Ponto de Ancoragem Ativo
    const activeAnchor = anchors.find(a => a.id === userPoseState.activeAnchorId) || anchors[0];
    bodyOverlayMeshRef.current.position.set(
      activeAnchor.x * 20 + userPoseState.positionX,
      activeAnchor.y * 15 + userPoseState.positionY,
      -25
    );

    const mat = bodyOverlayMeshRef.current.material as THREE.ShaderMaterial;
    if (mat && mat.uniforms && mat.uniforms.uOpacity) {
      mat.uniforms.uOpacity.value = userPoseState.bodyOpacity;
    }
  }, [userPoseState, anchors]);

  // Pointer Event Handlers (Mouse + Touch unified)
  const handlePointerDown = (clientX: number, clientY: number) => {
    isPointerDownRef.current = true;
    pointerStartRef.current = { x: clientX, y: clientY };
    hasMovedRef.current = false;
    velocityXRef.current = 0;
    velocityYRef.current = 0;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isPointerDownRef.current) return;

    const deltaX = clientX - pointerStartRef.current.x;
    const deltaY = clientY - pointerStartRef.current.y;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      hasMovedRef.current = true;
    }

    const sens = 0.25;
    targetLonRef.current -= deltaX * sens;
    targetLatRef.current += deltaY * sens;

    velocityXRef.current = -deltaX * sens * 0.4;
    velocityYRef.current = deltaY * sens * 0.4;

    pointerStartRef.current = { x: clientX, y: clientY };
  };

  const handlePointerUp = (clientX?: number, clientY?: number, containerRect?: DOMRect) => {
    if (!hasMovedRef.current && clientX !== undefined && clientY !== undefined && containerRect) {
      const x = clientX - containerRect.left;
      const y = clientY - containerRect.top;

      setClickIndicator({ x, y });
      setTimeout(() => setClickIndicator(null), 600);

      const normX = (x / containerRect.width) - 0.5;
      const normY = (y / containerRect.height) - 0.5;

      targetLonRef.current += normX * 90;
      targetLatRef.current -= normY * 60;
    }

    isPointerDownRef.current = false;
  };

  // Mouse Handlers
  const onMouseDown = (e: React.MouseEvent) => {
    handlePointerDown(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    const rect = mountRef.current?.getBoundingClientRect();
    handlePointerUp(e.clientX, e.clientY, rect);
  };

  // Touch Handlers for Mobile
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const rect = mountRef.current?.getBoundingClientRect();
    if (touch && rect) {
      handlePointerUp(touch.clientX, touch.clientY, rect);
    } else {
      handlePointerUp();
    }
  };

  const onDoubleClick = () => {
    targetLonRef.current = 0;
    targetLatRef.current = 0;
    velocityXRef.current = 0;
    velocityYRef.current = 0;
  };

  return (
    <div className="relative w-full h-full bg-[#0E0E0E] overflow-hidden select-none">
      
      {/* Canvas da Renderização Three.js WebGL Limpo sem Indicadores poluindo */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => handlePointerUp()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={onDoubleClick}
      >
        {/* Visual Click Feedback Ripple */}
        {clickIndicator && (
          <div
            className="absolute z-30 w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/30 animate-ping pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${clickIndicator.x}px`, top: `${clickIndicator.y}px` }}
          />
        )}
      </div>

    </div>
  );
};
