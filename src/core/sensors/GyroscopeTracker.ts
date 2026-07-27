import * as THREE from 'three';

/**
 * Fusion de Sensores e Normalizador de Giroscópio com Filtro Passa-Baixas e Slerp
 */
export class SmoothGyroscopeTracker {
  private currentQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private targetQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private euler: THREE.Euler = new THREE.Euler();
  private orientQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private zee: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  
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
   * Processa eventos de orientação do celular
   */
  public processDeviceOrientation(alpha: number | null, beta: number | null, gamma: number | null): void {
    if (alpha === null || beta === null || gamma === null) return;

    const alphaRad = alpha * (Math.PI / 180);
    const betaRad = beta * (Math.PI / 180);
    const gammaRad = gamma * (Math.PI / 180);

    // Ordem de Rotação YXZ da Câmera
    this.euler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
    this.targetQuaternion.setFromEuler(this.euler);

    // Ajusta a rotação de orientação da tela
    this.orientQuaternion.setFromAxisAngle(this.zee, -this.screenOrientationAngle);
    this.targetQuaternion.multiply(this.orientQuaternion);
  }

  /**
   * Atualiza a câmera Three.js suavemente via Slerp a 60 FPS
   */
  public updateCameraRotation(camera: THREE.PerspectiveCamera): void {
    this.currentQuaternion.slerp(this.targetQuaternion, this.smoothingFactor);
    camera.quaternion.copy(this.currentQuaternion);
  }
}
