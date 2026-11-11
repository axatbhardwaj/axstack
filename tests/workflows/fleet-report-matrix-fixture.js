// Public caller requirements, independent of the production scope allowlist.
export const auditors = ['axstack-auditor', 'axstack-auditor-sol'];
const sources = ['axstack-research-requirements', 'axstack-research-code', 'axstack-research-code-sol',
  'axstack-explore-execution', 'axstack-explore-execution-sol', 'axstack-research-web',
  'axstack-research-web-sol', 'axstack-research-x', 'axstack-diligence'];
const articleRoles = ['axstack-explainer', 'axstack-explainer-review', 'axstack-ui-verifier', 'axstack-ui-verifier-sonnet'];
const arena = ['axstack-advisor-codex', 'axstack-advisor-claude', 'axstack-arena-candidate-grok',
  'axstack-arena-judge-opus', 'axstack-escalation-fable', 'axstack-arena-judge-astra'];
export const reportWorkflows = {
  research: [...sources, ...auditors], explain: [...sources, ...articleRoles, ...auditors],
  publish: [...sources, ...articleRoles, ...auditors], brainstorm: [...arena, ...auditors],
  align: ['axstack-advisor-codex', 'axstack-advisor-claude', ...auditors],
  improve: ['axstack-research-code', 'axstack-research-code-sol', 'axstack-ui-verifier', 'axstack-ui-verifier-sonnet', ...auditors],
  audit: auditors,
  advice: ['axstack-advisor-codex', 'axstack-advisor-claude', 'axstack-escalation-fable'],
};
// Representative configured seats cover every newly supported direct family.
export const reportSeats = [
  ['align', ['axstack-advisor-codex', 'codex', 'gpt-6-astra', 'reasoningEffort', 'high']],
  ['align', ['axstack-advisor-claude', 'claudeAgent', 'claude-fable-5-2', 'effort', 'high']],
  ['improve', ['axstack-research-code', 'claudeAgent', 'claude-sonnet-5-5', 'effort', 'high']],
  ['improve', ['axstack-research-code-sol', 'codex', 'gpt-6.1-terra', 'reasoningEffort', 'high']],
  ['improve', ['axstack-ui-verifier', 'codex', 'gpt-6.1-terra', 'reasoningEffort', 'high']],
  ['improve', ['axstack-ui-verifier-sonnet', 'claudeAgent', 'claude-sonnet-5-5', 'effort', 'high']],
  ['advice', ['axstack-advisor-codex', 'codex', 'gpt-6-astra', 'reasoningEffort', 'high']],
  ['advice', ['axstack-advisor-claude', 'claudeAgent', 'claude-fable-5-2', 'effort', 'high']],
  ['advice', ['axstack-escalation-fable', 'claudeAgent', 'claude-fable-5-1', 'effort', 'high']],
  ...Object.keys(reportWorkflows).filter((workflow) => workflow !== 'advice').flatMap((workflow) => [
    [workflow, ['axstack-auditor', 'claudeAgent', 'claude-sonnet-5-5', 'effort', 'high']],
    [workflow, ['axstack-auditor-sol', 'codex', 'gpt-6.1-sol', 'reasoningEffort', 'high']],
  ]),
];
