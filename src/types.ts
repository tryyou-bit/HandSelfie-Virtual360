export interface Background360 {
  id: string;
  title: string;
  category: string;
  dataUrl: string;
  isUserUploaded?: boolean;
  lightingType?: string;
  recommendedAnchorY?: number;
  tags?: string[];
  description?: string;
}

export interface AnchorPoint {
  id: string;
  label: string;
  x: number; // -1 to 1
  y: number; // -1 to 1
  z: number; // -1 to 1
}

export interface UserPoseState {
  isCutoutActive: boolean;
  bodyOpacity: number;
  bodyScale: number;
  positionY: number;
  positionX: number;
  activeAnchorId: string;
  segmentationThreshold: number;
  feathering: number;
  segmentationEngine?: 'mediapipe' | 'chroma';
  chromaMode?: 'green' | 'blue' | 'luma' | 'custom';
  chromaTargetColor?: string;
  chromaTolerance?: number;
  spillSuppression?: number;
}

export interface SecurityStatus {
  antiDebugActive: boolean;
  wasmSimdEnabled: boolean;
  rateLimitTokens: number;
  cameraIntegrityVerified: boolean;
  firebaseRulesValidated: boolean;
}
