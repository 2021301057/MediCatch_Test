import api from './client';

// ── Auth ──────────────────────────────────────────
export const authAPI = {
  login:        (data) => api.post('/auth/login', data),
  signupStep1:  (data) => api.post('/auth/signup/step1', data),
  signupStep2:  (data) => api.post('/auth/signup/step2', data),
  signupStep3:  (data) => api.post('/auth/signup/step3', data),
  signupStep4:  (data) => api.post('/auth/signup/step4', data),
  refresh:      (token) => api.post('/auth/refresh', { refreshToken: token }),
  profile:      () => api.get('/auth/profile'),
};

// ── Health ────────────────────────────────────────
export const healthAPI = {
  getMedicalRecords: (params) => api.get('/health/medical-records', { params }),
  getMedications:    (recordId) => api.get(`/health/medical-records/${recordId}/medications`),
  getCheckupResults: () => api.get('/health/checkup-results'),
  getCheckupByYear:  (year) => api.get(`/health/checkup-results/${year}`),
  getDiseasePredictions: () => api.get('/health/disease-predictions'),
  getCheckupTargets: () => api.get('/health/checkup-targets'),
  syncStep1: (data) => api.post('/health/sync/step1', data, { timeout: 120000 }),
  syncStep2: (data) => api.post('/health/sync/step2', data, { timeout: 120000 }),
};

// ── Insurance ─────────────────────────────────────
export const insuranceAPI = {
  getPolicies:   () => api.get('/insurance/policies'),
  getCoverage:   (policyId) => api.get(`/insurance/policies/${policyId}/coverage`),
  getSummary:    () => api.get('/insurance/summary'),
  sync:          (data) => api.post('/insurance/sync', data, { timeout: 60000 }),
};

// ── Analysis ──────────────────────────────────────
export const analysisAPI = {
  searchTreatment:     (keyword) => api.get('/analysis/pre-treatment-search', { params: { keyword } }),
  getTreatmentCoverage:(id) => api.get(`/analysis/pre-treatment-search/${id}/coverage`),
  getCoverageGap:      () => api.get('/analysis/coverage-gap'),
  getClaimOpportunities: () => api.get('/analysis/claim-opportunities'),
  completeClaim:       (claimId) => api.post(`/analysis/claim-opportunities/${claimId}/complete`),
  getHealthReport:     (months = 12) => api.get('/analysis/health-report', { params: { period: `${months}months` } }),
  getMedicalPatterns:  () => api.get('/analysis/health-report/medical-patterns'),
  getInsuranceUsage:   () => api.get('/analysis/health-report/insurance-usage'),
};

// ── Recommend ─────────────────────────────────────
export const recommendAPI = {
  getProducts:    () => api.get('/recommend/insurance-products'),
  getOptimization:() => api.get('/recommend/premium-optimization'),
};

// ── Chat ──────────────────────────────────────────
export const chatAPI = {
  sendMessage: (message) => api.post('/chat/message', { message }),
  getHistory:  () => api.get('/chat/history'),
  clearHistory:() => api.delete('/chat/history'),
};
