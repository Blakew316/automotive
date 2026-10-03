// Small Engine Edition troubleshooting guide. Placeholder shape — filled in with the full guide.

/**
 * id, label, keywords (search words), types (EQUIPMENT_TYPES ids it applies to, or null for all),
 * causes: [{ title, likelihood: 'common' | 'possible' | 'less common', checks: [first checks, in order], jobId (SE_CANNED_JOBS id, optional) }]
 */
export const SE_SYMPTOMS = [
  {
    id: 'no-start',
    label: 'Won’t start',
    keywords: 'no start wont start cranks but wont start hard starting',
    types: null,
    causes: [{ title: 'Stale or contaminated fuel', likelihood: 'common', checks: ['Smell and look at the fuel; drain if older than about 30 days or cloudy'], jobId: 'se-carb-clean' }],
  },
];
