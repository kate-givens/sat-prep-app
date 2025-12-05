export const SAT_STRUCTURE = [
  {
    domainId: 'RW_II',
    domainName: 'Information and Ideas',
    weight: 0.26,
    skills: [
      { skillId: 'RW_II_CID', name: 'Central Ideas and Details' },
      { skillId: 'RW_II_INF', name: 'Inferences' },
      { skillId: 'RW_II_COE', name: 'Command of Evidence' },
    ],
  },
  {
    domainId: 'RW_CS',
    domainName: 'Craft and Structure',
    weight: 0.28,
    skills: [
      { skillId: 'RW_CS_WIC', name: 'Words in Context' },
      { skillId: 'RW_CS_TSP', name: 'Text Structure and Purpose' },
      { skillId: 'RW_CS_CTC', name: 'Cross-Text Connections' },
    ],
  },
  {
    domainId: 'RW_EOI',
    domainName: 'Expression of Ideas',
    weight: 0.2,
    skills: [
      { skillId: 'RW_EOI_RHS', name: 'Rhetorical Synthesis' },
      { skillId: 'RW_EOI_TRN', name: 'Transitions' },
    ],
  },
  {
    domainId: 'RW_SEC',
    domainName: 'Standard English Conventions',
    weight: 0.26,
    skills: [
      { skillId: 'RW_SEC_BND', name: 'Boundaries' },
      { skillId: 'RW_SEC_FSS', name: 'Form, Structure, and Sense' },
    ],
  },
  {
    domainId: 'M_ALG',
    domainName: 'Algebra',
    weight: 0.35,
    skills: [
      { skillId: 'M_ALG_LIN1', name: 'Linear equations in one variable' },
      { skillId: 'M_ALG_FUNC', name: 'Linear functions' },
      { skillId: 'M_ALG_LIN2', name: 'Linear equations in two variables' },
      {
        skillId: 'M_ALG_SYS',
        name: 'Systems of two linear equations in two variables',
      },
      {
        skillId: 'M_ALG_INEQ',
        name: 'Linear inequalities in one or two variables',
      },
    ],
  },
  {
    domainId: 'M_ADV',
    domainName: 'Advanced Math',
    weight: 0.35,
    skills: [
      { skillId: 'M_ADV_NONF', name: 'Nonlinear functions' },
      { skillId: 'M_ADV_NONE', name: 'Nonlinear equations in one variable' },
      { skillId: 'M_ADV_SYS', name: 'Systems of equations in two variables' },
      { skillId: 'M_ADV_EXP', name: 'Equivalent expressions' },
    ],
  },
  {
    domainId: 'M_PSD',
    domainName: 'Problem-Solving and Data Analysis',
    weight: 0.15,
    skills: [
      {
        skillId: 'M_PSD_RAT',
        name: 'Ratios, rates, proportional relationships, and units',
      },
      { skillId: 'M_PSD_PCT', name: 'Percentages' },
      {
        skillId: 'M_PSD_OV',
        name: 'One-variable data: Distributions and measures',
      },
      {
        skillId: 'M_PSD_TV',
        name: 'Two-variable data: Models and scatterplots',
      },
      {
        skillId: 'M_PSD_PROB',
        name: 'Probability and conditional probability',
      },
      {
        skillId: 'M_PSD_INF',
        name: 'Inference from sample statistics and margin of error',
      },
      {
        skillId: 'M_PSD_EVAL',
        name: 'Evaluating statistical claims: Observational studies',
      },
    ],
  },
  {
    domainId: 'M_GEO',
    domainName: 'Geometry and Trigonometry',
    weight: 0.15,
    skills: [
      { skillId: 'M_GEO_AV', name: 'Area and volume' },
      { skillId: 'M_GEO_LAT', name: 'Lines, angles, and triangles' },
      { skillId: 'M_GEO_RTT', name: 'Right triangles and trigonometry' },
      { skillId: 'M_GEO_CIR', name: 'Circles' },
    ],
  },
];

export const ALL_SKILLS = SAT_STRUCTURE.flatMap((domain) =>
  domain.skills.map((skill) => ({
    ...skill,
    domainId: domain.domainId,
    domainName: domain.domainName,
    domainWeight: domain.weight,
  }))
);