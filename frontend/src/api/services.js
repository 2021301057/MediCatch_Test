import api from './client';

const withAliases = (row, aliases) => {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  Object.entries(aliases).forEach(([snake, camel]) => {
    if (next[snake] === undefined && next[camel] !== undefined) next[snake] = next[camel];
    if (next[camel] === undefined && next[snake] !== undefined) next[camel] = next[snake];
  });
  return next;
};

const normalizeMedicalRecord = (row) => {
  const r = withAliases(row, {
    visit_date: 'visitDate',
    hospital: 'hospitalName',
    treatment_details: 'treatmentType',
    out_of_pocket: 'patientPayment',
    insurance_coverage: 'insurancePayment',
    medical_cost: 'totalCost',
    non_covered_amount: 'nonCoveredAmount',
    claim_status: 'claimStatus',
    disease_code: 'diseaseCode',
  });
  // 약국: diseaseCode '$' 또는 병원명에 '약국' 포함
  if (r.diseaseCode === '$' || (r.hospitalName || '').includes('약국')) {
    r.treatmentType = '약국';
  }
  return r;
};

const normalizeCheckupResult = (row) => withAliases(row, {
  checkup_date: 'checkupDate',
  checkup_type: 'checkupType',
  blood_pressure_systolic: 'bloodPressureSystolic',
  blood_pressure_diastolic: 'bloodPressureDiastolic',
  total_cholesterol: 'totalCholesterol',
  hdl_cholesterol: 'hdlCholesterol',
  ldl_cholesterol: 'ldlCholesterol',
  urinary_protein: 'urinaryProtein',
  serum_creatinine: 'serumCreatinine',
  gamma_gtp: 'gammaGtp',
  tb_chest_disease: 'tbChestDisease',
  organization_name: 'organizationName',
  abnormal_findings: 'abnormalFindings',
});

const normalizePolicy = (row) => {
  const policy = withAliases(row, {
    insurer_name: 'companyName',
    policy_details: 'productName',
    policy_number: 'policyNumber',
    policy_number_hid: 'policyNumberHid',
    insurance_type: 'policyType',
    start_date: 'startDate',
    end_date: 'endDate',
    monthly_premium: 'monthlyPremium',
    premium_amount: 'premiumAmount',
    payment_cycle: 'paymentCycle',
    payment_period: 'paymentPeriod',
    has_supplementary_coverage: 'hasSupplementaryCoverage',
    coverage_items: 'coverageItems',
  });
  if (Array.isArray(policy.coverage_items)) {
    policy.coverage_items = policy.coverage_items.map((item) => withAliases(item, {
      item_name: 'name',
      max_benefit_amount: 'amount',
      is_covered: 'isCovered',
    }));
    policy.coverageItems = policy.coverage_items;
  }
  return policy;
};

const withSyncRequestAliases = (data = {}) => ({
  ...data,
  ...(data.userId !== undefined ? { user_id: data.userId } : {}),
  ...(data.codefId !== undefined ? { codef_id: data.codefId } : {}),
  ...(data.codefPassword !== undefined ? { codef_password: data.codefPassword } : {}),
  ...(data.userName !== undefined ? { user_name: data.userName } : {}),
  ...(data.phoneNo !== undefined ? { phone_no: data.phoneNo } : {}),
  ...(data.loginTypeLevel !== undefined ? { login_type_level: data.loginTypeLevel } : {}),
});

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
  getMedicalRecords: () => api.get('/health/medical-records')
    .then((rows) => Array.isArray(rows) ? rows.map(normalizeMedicalRecord) : rows),
  getMedications:    () => api.get('/health/medications'),
  getCheckupResults: () => api.get('/health/checkup-results')
    .then((rows) => Array.isArray(rows) ? rows.map(normalizeCheckupResult) : rows),
  getDiseasePredictions: () => api.get('/health/disease-predictions'),
  getHealthAge: () => api.get('/health/health-age'),
  getCheckupTargets: () => api.get('/health/checkup-targets'),
  syncCheckupStep1: (data) => api.post('/health/sync/checkup/step1', withSyncRequestAliases(data), { timeout: 120000 }),
  syncCheckupStep2: (data) => api.post('/health/sync/checkup/step2', data, { timeout: 120000 }),
  syncMedicalStep1: (data) => api.post('/health/sync/medical/step1', withSyncRequestAliases(data), { timeout: 120000 }),
  syncMedicalStep2: (data) => api.post('/health/sync/medical/step2', data, { timeout: 120000 }),
};

// ── Insurance ─────────────────────────────────────
export const insuranceAPI = {
  getPolicies:   () => api.get('/insurance/policies')
    .then((rows) => Array.isArray(rows) ? rows.map(normalizePolicy) : rows),
  getCoverage:   (policyId) => api.get(`/insurance/policies/${policyId}/coverage`),
  getCoverageComparison: () => api.get('/insurance/coverage-comparison')
    .then((rows) => Array.isArray(rows) ? rows.map((row) => withAliases(row, {
      coverage_name: 'coverageName',
      coverage_code: 'coverageCode',
      self_coverage_amount: 'selfCoverageAmount',
      avg_group_coverage_amount: 'avgGroupCoverageAmount',
    })) : rows),
  getSummary:    () => api.get('/insurance/summary'),
  sync:          (data) => api.post('/insurance/sync', withSyncRequestAliases(data), { timeout: 60000 }),
};

// ── Analysis ──────────────────────────────────────
export const analysisAPI = {
  searchPreTreatment:  (data) => api.post('/analysis/pre-treatment-search', data),
  searchTreatment:     (keyword) => api.post('/analysis/pre-treatment-search', { query: keyword }),
  getTreatmentCoverage:(id) => api.get(`/analysis/pre-treatment-search/${id}/coverage`),
  getCoverageGap:      () => api.get('/analysis/coverage-gaps'),
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
