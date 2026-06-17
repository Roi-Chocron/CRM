// API Configuration
export const API_URL = import.meta.env.MODE === 'production' 
  ? 'https://crm-backend.roi-chocron7.workers.dev' 
  : '';
