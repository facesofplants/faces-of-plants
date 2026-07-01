export interface SystemSetting {
  settingKey: string;
  settingValue: string;
  category: 'api_keys' | 'features' | 'system';
  description?: string;
  masked?: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  userType: 'admin' | 'citizen' | 'researcher';
  createdAt?: string;
  lastLogin?: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalCollections: number;
  recentLogins: number;
}

export const API_KEY_DEFINITIONS: Omit<SystemSetting, 'settingValue' | 'updatedBy' | 'updatedAt'>[] = [
  { settingKey: 'api:plantnet', category: 'api_keys', description: 'PlantNet API key for plant identification', masked: true },
  { settingKey: 'api:llm', category: 'api_keys', description: 'LLM API key (Mistral/OpenAI) for natural language queries', masked: true },
  { settingKey: 'api:gbif_user_agent', category: 'api_keys', description: 'GBIF User-Agent identifier', masked: false },
  { settingKey: 'api:inaturalist_user_agent', category: 'api_keys', description: 'iNaturalist User-Agent identifier', masked: false },
  { settingKey: 'api:eol', category: 'api_keys', description: 'Encyclopedia of Life API key (optional)', masked: true },
  { settingKey: 'analytics:ga4:web_measurement_id', category: 'system', description: 'GA4 Measurement ID for facesofplants.org', masked: false },
  { settingKey: 'analytics:ga4:admin_measurement_id', category: 'system', description: 'GA4 Measurement ID for console.facesofplants.org', masked: false },
];

export const FEATURE_FLAGS: Omit<SystemSetting, 'settingValue' | 'updatedBy' | 'updatedAt'>[] = [
  { settingKey: 'feature:pathology', category: 'features', description: 'Plant disease detection (ONNX)', masked: false },
  { settingKey: 'feature:corridors', category: 'features', description: 'Ecological corridor analysis', masked: false },
  { settingKey: 'feature:sdm', category: 'features', description: 'Species distribution modeling', masked: false },
  { settingKey: 'feature:plantnet', category: 'features', description: 'Plant identification via PlantNet', masked: false },
  { settingKey: 'feature:nearby', category: 'features', description: 'Nearby species search', masked: false },
];
