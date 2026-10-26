// Expected recovery actions bind scenarios to their shipped rule paragraphs.
export const recovery = {
  'lost-writer-dispatch-response': [
    [/lost delegated.*response/is, [/retry/i, /same stable/i, /clientRequestId/, /recover task identity/i, /never start a second writer/i, /outcome is unknown/i]],
  ],
  'silent-provisioning-failure': [
    [/post-launch/i, [/launch failure/i, /activeRunId/, /worktreePath/, /started/i, /still preparing/i, /hold/i, /next wake/i]],
    [/task_status failed/i, [/incomplete/i]],
  ],
  'writer-death-after-idle': [
    [/unsettled launched thread/i, [/failed run/i, /hold/i, /incomplete/i]],
    [/replacement after terminal failure/i, [/terminal failure/i, /a<n\+1>/, /failed/i, /branch/i, /salvage/i]],
  ],
  'stale-completion': [
    [/completion must match/i, [/current attempt/i, /SHA/, /receipt/i, /evidence/i]],
    [/driver must persist only the task_status/i, [/persist/i, /task_status/, /before/i, /t3_thread_read|thread reads/i]],
    [/launched writer completion/i, [/require/i, /terminal/i]],
  ],
  'child-question-resume': [
    [/For a delegated child/i, [/t3_pending_request_list/, /childThreadId/]],
    [/Use t3_pending_request_read/i, [/t3_pending_request_read/, /still pending/i, /answer once/i, /existing authority/i, /t3_pending_request_respond/]],
  ],
};
