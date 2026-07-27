import { Background360 } from '../types';

/**
 * Gera imagens equirretangulares 360° procedurais via HTML5 Canvas em alta resolução (2048x1024)
 * Garantindo funcionamento 100% offline e imediato sem dependência de URLs externas.
 */
export function generateProcedural360Backgrounds(): Background360[] {
  const width = 2048;
  const height = 1024;

  // 1. Cyberpunk Neon City
  const cyberpunkCanvas = document.createElement('canvas');
  cyberpunkCanvas.width = width;
  cyberpunkCanvas.height = height;
  const ctx1 = cyberpunkCanvas.getContext('2d')!;

  // Céu gradiente noturno
  const grad1 = ctx1.createLinearGradient(0, 0, 0, height);
  grad1.addColorStop(0, '#0f051d');
  grad1.addColorStop(0.4, '#290a59');
  grad1.addColorStop(0.7, '#ff0077');
  grad1.addColorStop(1, '#05d9e8');
  ctx1.fillStyle = grad1;
  ctx1.fillRect(0, 0, width, height);

  // Linha do horizonte e prédios
  const horizonY = height * 0.55;
  ctx1.fillStyle = '#0a0314';
  const numBuildings = 60;
  const buildingWidth = width / numBuildings;

  for (let i = 0; i < numBuildings; i++) {
    const h = 100 + Math.sin(i * 3) * 180 + Math.cos(i * 7) * 120;
    const x = i * buildingWidth;
    ctx1.fillRect(x, horizonY - h, buildingWidth + 1, h + height * 0.5);

    // Janelas iluminadas em néon
    ctx1.fillStyle = i % 2 === 0 ? '#05d9e8' : '#ff0077';
    for (let wy = horizonY - h + 20; wy < horizonY - 10; wy += 25) {
      for (let wx = x + 5; wx < x + buildingWidth - 5; wx += 15) {
        if (Math.sin(wx * wy) > 0.1) {
          ctx1.fillRect(wx, wy, 8, 12);
        }
      }
    }
    ctx1.fillStyle = '#0a0314';
  }

  // Chão e grid futurista
  ctx1.fillStyle = '#05020c';
  ctx1.fillRect(0, horizonY, width, height - horizonY);

  ctx1.strokeStyle = '#05d9e8';
  ctx1.lineWidth = 1.5;
  for (let x = 0; x < width; x += 80) {
    ctx1.beginPath();
    ctx1.moveTo(x, horizonY);
    ctx1.lineTo(x, height);
    ctx1.stroke();
  }

  // 2. Sunset Beach
  const sunsetCanvas = document.createElement('canvas');
  sunsetCanvas.width = width;
  sunsetCanvas.height = height;
  const ctx2 = sunsetCanvas.getContext('2d')!;

  const grad2 = ctx2.createLinearGradient(0, 0, 0, height);
  grad2.addColorStop(0, '#1a0033');
  grad2.addColorStop(0.3, '#ff3300');
  grad2.addColorStop(0.55, '#ffaa00');
  grad2.addColorStop(0.6, '#0088cc');
  grad2.addColorStop(1, '#002244');
  ctx2.fillStyle = grad2;
  ctx2.fillRect(0, 0, width, height);

  // Sol no horizonte
  const sunX = width * 0.5;
  const sunY = height * 0.52;
  const sunGrad = ctx2.createRadialGradient(sunX, sunY, 10, sunX, sunY, 160);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.3, '#ffff88');
  sunGrad.addColorStop(1, 'rgba(255, 170, 0, 0)');
  ctx2.fillStyle = sunGrad;
  ctx2.beginPath();
  ctx2.arc(sunX, sunY, 160, 0, Math.PI * 2);
  ctx2.fill();

  // 3. Space Station Orbital
  const spaceCanvas = document.createElement('canvas');
  spaceCanvas.width = width;
  spaceCanvas.height = height;
  const ctx3 = spaceCanvas.getContext('2d')!;

  ctx3.fillStyle = '#020208';
  ctx3.fillRect(0, 0, width, height);

  // Estrelas
  for (let i = 0; i < 800; i++) {
    const sx = Math.random() * width;
    const sy = Math.random() * height;
    const sr = Math.random() * 1.8;
    ctx3.fillStyle = Math.random() > 0.3 ? '#ffffff' : '#77ccff';
    ctx3.beginPath();
    ctx3.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx3.fill();
  }

  // Planeta Gigante
  const planetGrad = ctx3.createRadialGradient(width * 0.7, height * 0.6, 100, width * 0.7, height * 0.6, 450);
  planetGrad.addColorStop(0, '#00aaff');
  planetGrad.addColorStop(0.5, '#002266');
  planetGrad.addColorStop(1, '#000511');
  ctx3.fillStyle = planetGrad;
  ctx3.beginPath();
  ctx3.arc(width * 0.7, height * 0.6, 450, 0, Math.PI * 2);
  ctx3.fill();

  return [
    {
      id: 'cyberpunk-neon',
      title: 'Metrópole Cyberpunk Néon',
      category: 'Futurista',
      dataUrl: cyberpunkCanvas.toDataURL('image/jpeg', 0.85),
      lightingType: 'Néon Violeta/Ciano',
      recommendedAnchorY: 0.1,
      tags: ['cyberpunk', 'neon', 'cidade', 'noite'],
      description: 'Horizonte urbano futurista com iluminação de alto contraste néon violeta e ciano.'
    },
    {
      id: 'beach-sunset',
      title: 'Pôr do Sol Tropical',
      category: 'Natureza',
      dataUrl: sunsetCanvas.toDataURL('image/jpeg', 0.85),
      lightingType: 'Luz Quente de Pôr do Sol',
      recommendedAnchorY: 0.0,
      tags: ['praia', 'por do sol', 'quente', 'natureza'],
      description: 'Cenário costeiro com luz solar rasante dourada e reflexos quentes.'
    },
    {
      id: 'orbital-space',
      title: 'Estação Orbital do Espaço',
      category: 'Ficção Científica',
      dataUrl: spaceCanvas.toDataURL('image/jpeg', 0.85),
      lightingType: 'Luz Fria do Espaço Sideral',
      recommendedAnchorY: -0.1,
      tags: ['espaco', 'planeta', 'orbita', 'estrelas'],
      description: 'Vista orbital da Terra e campo estelar profundo com iluminação azul fria.'
    }
  ];
}
