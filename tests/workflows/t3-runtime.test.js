import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { sentences, requires, prohibits } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const reference = () => read('skills/axstack/references/t3-runtime.md');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const runtime = () => reference().replace(/[`*]/g, '').replace(/^#+.*$/gm, '').replace(/\|\n/g, '|.\n');
const exactSentences = (text) => text.split(/\n\s*\n/)
  .flatMap((paragraph) => normalize(paragraph).split(/(?<=[.!?])\s+/));

// Safety-critical sentences are exact-text contracts; deliberate wording changes
// require a corresponding pin edit. Whitespace alone is irrelevant.
const pins = [
  ["human merge authority","Human merges by default."],
  ["driver ownership","The driver must be the sole run-record writer and enforce one writer per candidate; it never writes tracked files or repairs an author's source."],
  ["repair ownership","Repairs return to that author."],
  ["prompt refusal","Never answer trust or permission prompts; brief confirmation adds no authority and does not answer a harness or tool dialog."],
  ["prompt refusal hold","A permission prompt or provider safety refusal must be a held, incomplete outcome; never bypass or retry it through another model."],
  ["additional prompt holds","Trust, hook review, authentication and model prompts also hold; preserve the attempt and inspect native state before any authorized recovery."],
  ["availability hold","An unavailable provider, model, role, mode or effort must hold that role with no substitution."],
  ["safe deletion","Deletion must target an exact validated owned path inside evidence, TMPDIR or the worktree, using a literal absolute path or `${VAR:?}`-guarded path: no glob, no parent-root deletion; never wipe a general cache."],
  ["uncertain path retention","Uncertain paths are preserved for reconciliation."],
  ["terminal evidence retention","T3 terminal state alone does not authorize discarding evidence."],
  ["SHA baseRef","`baseRef` must always be a commit SHA, never a branch name; T3 renames its `t3code/*` branches."],
  ["status persistence","The driver must persist `task_status` in private evidence before any `t3_thread_read` for that delegated task; save the whole response before consuming or expanding its result."],
  ["delegated isolation","After each delegated completion the driver must check its own `HEAD` and `git status --porcelain` against their pre-dispatch values: both stay unchanged, including untracked entries."],
  ["isolation hold","Any change is a hold before advancing that work."],
  ["fresh review retention","Later review gets a fresh checkout; unknown or active evidence and unique bytes stay preserved."],
];

for (const [name, sentence] of pins) {
  test(`T3 exact text: ${name}`, () => {
    const sentences = exactSentences(reference());
    const pinned = normalize(sentence);
    expect(sentences.filter((s) => s === pinned).length).toBe(1);
  });
}

// Every other instruction uses sentence-scoped concepts and the shared denial
// guard. Negative instructions use its small explicit-prohibition mask.
const rules = [
  ["capabilities", [/\bdriver/i, /\bT3 thread/i, /\bsav\w*/i, /\borchestrator_capabilities/, /\bJSON/, /\bschema/i]],
  ["missing capability", [/\bmissing capability/i, /\b(?:holds?|held)\b/i, /\baffected operation/i], /\bwithout a substitute runtime/i],
  ["role snapshot", [/\broles.json/, /\bsnapshot/i, /\bpreset/i, /\bstable role IDs/i, /\brequested/i, /\bresolved/i, /\bsource/i, /\btime/i]],
  ["snapshot resume", [/\bresume/i, /\bsnapshot/i], /\bno re-resolution/i],
  ["snapshot change", [/\bchanges/i, /\brequir/i, /\buser/i, /\bexplicit decision/i]],
  ["provider mapping", [/\bbindings/i, /\bcodex→codex/, /\bclaude→claudeAgent/, /grok→grok/, /\bantigravity→antigravity/]],
  ["mode and options", [/\bmodeId/, /\bruntimeMode:full-access/, /\boptions:\[\{id,value\}\]/]],
  ["pinned model", [/\bpreset model/i, /\bused|use/i, /\bas given/i]],
  ["class resolution", [/\bmodelClass/, /\bresol(?:v|ution)/i, /\bnewest/i, /\bprovider/i, /gpt-<N>-<class>/, /\bclaude-<class>-<N>-<N>/]],
  ["resolution catalog", [/\bresolve-models.js/, /--provider/, /\bsaved capabilities JSON path/i]],
  ["null model", [/model:null/, /first model/i, /saved capabilities/i, /only/i, /grok/i, /antigravity/i, /launch-by-agent-id/i]],
  ["null ID receipt", [/record/i, /exact ID/i, /unresolved provider default/i]],
  ["antigravity models", [/antigravity/i, /\b(?:holds?|held)\b/i, /saved capabilities/i, /zero models/i]],
  ["intentional model absence", [/codex/i, /claude/i, /lacking both model and class/i, /intentional absence/i, /hold/i]],
  ["absent provider default", [/provider default/i, /role/i, /use/i], /never/i],
  ["catalog hold", [/\bmissing|malformed/i, /\bcatalog/i, /\b(?:holds?|held)\b/i, /\bresolution/i]],
  ["no alternative on failure", [/\bauth/i, /\bquota/i, /\btimeout/i, /\breject/i, /\balternative/i], /\bdo not select|never select/i],
  ["absent seats", [/intentional/i, /\babsent seats/i, /\brecorded absences/i]],
  ["runtime availability", [/\bavailability/i, /\bruntime proof/i]],
  ["codex effort", [/\bcodex/i, /\beffort/i, /\boption ID/i, /\breasoningEffort/]],
  ["claude effort", [/\bclaude/i, /\beffort/i, /\b(?:option ID effort|effort option ID)\b/i]],
  ["grok effort", [/\bgrok/i, /\breasoningEffort/, /\bexclud\w* max\b/i]],
  ["Grok CLI floor", [/\bCLI/, /\brequir|must/i, /≥1\.0\.13/]],
  ["Grok readiness proof", [/grok/i, /\balone/i, /\bprove|establish/i, /\bCLI/i, /\bruns/i], /\bdoes not|cannot/i],
  ["opencode effort", [/\bopencode/i, /\beffort/i, /\bvariant/], /\bno OpenCode role enters this migration/i],
  ["binding echo", [/\bdispatch echo/i, /\bmatch/i, /\brequested/i, /\bprovider/i, /\bmodel/i]],
  ["binding readback", [/\bverif/i, /\boptions/i, /\bruntimeMode/, /\bt3_thread_configuration/, /\bread.back/i]],
  ["separate binding evidence", [/\brecord|ke(?:ep|pt)/i, /\brequested/i, /\beffective/i, /\bseparat/i]],
  ["worker proof", [/\bworker self.report/i, /\bconfiguration proof/i], /\bnot|never/i],
  ["missing effort readback", [/\bmissing effort read.back/i, /\b(?:holds?|held)\b/i, /\broles/i, /\beffort/i]],
  ["effort satisfaction", [/\brecord/i, /\bsatisfied/i], /\bnever (?:be )?record/i],
  ["other effort limitation", [/\bother providers/i, /\beffort read.back/i, /\bunverified/i, /\bexercised|tested/i]],
  ["first configuration canary", [/\bfirst dispatch/i, /\bprovider/i, /\bmodel/i, /\beffort/i, /\brunning/i, /\bcompleted/i, /\bbefore/i, /\bsiblings/i]],
  ["canary rejection", [/\breject/i, /\bstop|block/i, /\bsiblings/i, /\bconfiguration/i]],
  ["unrelated configurations", [/\bunrelated configurations/i, /\beligible|\badmissible/i]],
  ["read-only delegates", [/\badvisers/i, /\bresearch/i, /\bdiligence/i, /\bdelegate_task/, /\basync/i, /\bdriver worktree/i, /\btitle = dispatch key/i]],
  ["delegate untouched", [/\btracked/i, /\buntracked/i, /\bfiles/i, /\buntouched/i]],
  ["delegate evidence", [/\bwrites only/i, /<run>\/evidence\/<key>\//]],
  ["probe delegates", [/\breviewers/i, /\bdebug investigators/i, /\bexecution investigators/i, /\bUI verifier/i, /\bdelegate_task/, /\basync/i, /\btitle = dispatch key/i]],
  ["probe checkout", [/\bdisposable/i, /\bdetached/i, /\bcandidate SHA/i, /\bpinned base/i, /git worktree add --detach/]],
  ["probe cd", [/\bbrief/i, /\brequir/i, /\bcd/i, /into it/i]],
  ["probe outputs", [/\bdisposable probes/i, /\boutputs/i, /<run>\/evidence\/<key>\//]],
  ["writer launch", [/\bauthor/i, /\bcode-arena/i, /\bt3_thread_launch/, /\btype:worktree/, /\bstartFromOrigin:false/, /\bown worktree/i, /\bmerges or closes/i]],
  ["owner row", [/\bowner/i, /\bdriver thread/i, /\bdriver worktree/i]],
  ["owner source exclusion", [/\btracked files/i], /\bnever (?:writes|edits|changes) tracked files|never (?:be )?(?:written|edited|changed)/i],
  ["owner worker exclusion", [/\bworker launch/i], /\bNo worker launch/i],
  ["idle ownership", [/\bmissing/i, /idle/i, /\bsession/i, /\bownership/i, /\btransfer/i], /\bno ownership transfer|never (?:grant ownership transfer|transfers?)/i],
  ["driver preset exclusion", [/\bcurrent/i, /\bchat\/driver|driver/i, /\bpreset/i, /\brole/i, /\brow|entry/i], /\bno (?:role (?:row|entry)|preset)/i],
  ["key and title", [/\bdispatch key/i, /<run>:<role>:<task>:a<n>/, /\bbefore/i, /\blaunch/i, /\bexact whole/i, /\bT3 title/i]],
  ["substring identity", [/\bsubstring matches/i, /\bestablish/i, /identity/i], /\bdo not|not/i],
  ["branch naming", [/\bbranch/i, /\baxstack\/<run>\/<role>\/<task>-a<n>/]],
  ["branch encoding", [/\blowercas/i, /\beach segment/i, /\breplace/i, /\[\^a-z0-9-\]/, /\bwith -/]],
  ["dispatch original", [/\bdispatch key/i, /\boriginal form/i, /\bboth/i, /\brecord/i]],
  ["normalization identity", [/\bnormalization/i, /identity substitute/i], /\bnever/i],
  ["pinned dispatch revisions", [/\bpin/i, /\bbase/i, /\bcandidate/i, /\bbefore/i, /\bdispatch/i]],
  ["receipt protocol", [/\bworkers/i, /\bexactly one final marker/i, /\bAXSTACK-DONE key=/, /\bhead=/, /\breport=/, /\bAXSTACK-FAILED key=/, /\bAXSTACK-QUESTION key=/, /\bq=/]],
  ["report identity", [/\breports/i, /\babsolute/i, /\bprivate evidence paths/i]],
  ["report-only head", [/\breport.only head/i, /\bpinned candidate SHA/i]],
  ["writer delivery", [/\blaunched writers/i, /\bmarker/i, /\bt3_thread_send/, /\brecorded driver thread/i]],
  ["delegate delivery", [/\bdelegated children/i, /\bfinal result/i]],
  ["delegate completion", [/\bdelegated completion/i, /\brequir/i, /\bterminal/i, /\bcompleted/, /\bresult_available/, /\bhasPendingChildRuns:false/, /\bAXSTACK-DONE/]],
  ["question incomplete", [/\bquestion/i, /\bincomplete/i, /\bcompleted/i]],
  ["writer completion", [/\blaunched writer completion/i, /\brequir/i, /\bterminal/i, /\bt3_thread_wait/, /\bnon.empty diff/i, /\bclean tree/i, /\bred\/green/i]],
  ["message progress", [/\breceipt message alone/i, /\bonly/i, /\bprogress/i]],
  ["current completion", [/\bcompletion/i, /\bcurrent attempt key/i, /\bcandidate SHA/i]],
  ["stale completion", [/\bolder attempt/i, /\bcomplet\w*/i, /\bnewer/i], /\bnever/i],
  ["stale receipt evidence", [/\bstale/i, /\bduplicate receipts/i, /\bevidence/i, /\bdeduplicated/i, /\bruntime identity/i]],
  ["delivery validation", [/\bwhole delivery/i, /\bbefore/i, /\backnowledgment/i, /\badvance only after/i, /\bsender/i, /\bscope/i, /\bartifacts/i]],
  ["failure classification", [/\btask_status failed/, /\bfailed or interrupted/i, /\bpreparing thread error/i, /\bAXSTACK-FAILED/, /incomplete outcome/i, /\bpreserved evidence/i]],
  ["silence completion", [/\bsilence/i, /\bsuccessful completion/i], /\bnot|never/i],
  ["launch recovery inventory", [/\blost launch response/i, /\bfully paginated/i, /\bt3_thread_list/, /\btitleContains=<key>/, /\bexact whole.title equality/i, /git worktree list/]],
  ["reserved branch", [/\bke(?:ep|pt)/i, /\breserved branch/i, /\brecovery/i]],
  ["unreconciled worktree", [/\bbranch/i, /\bworktree/i, /\bwithout a reconciled thread/i, /\bprevent\w*/i, /\bproof of absence/i], /\bwithout a reconciled thread/i],
  ["launch recovery outcomes", [/\brecovery/i, /\badopt/i, /\bone exact match/i, /\bworktree/i, /\bbranch/i, /\bagree/i]],
  ["relaunch absence", [/\bproven absence/i, /\brelaunch once/i, /\bsame reserved key/i, /\bbranch/i]],
  ["recovery hold", [/\bseveral matches/i, /\bconflicts/i, /\bsecond uncertain response/i, /incomplete inventory/i, /\b(?:holds?|held)\b/i]],
  ["silence duplicate", [/\bduplicate writer/i, /\bsilence/i, /\blaunch|start|justif/i], /\bnever/i],
  ["post-launch wait", [/\bpost.launch/i, /\bdriver/i, /\bt3_thread_wait/, /\btimeoutMs:120000/, /\bfailed/i, /\blaunch failure/i]],
  ["timed-out started", [/\btimed.out/i, /\bt3_thread_read/, /\bactiveRunId/, /\bworktreePath/, /\bstarted/i]],
  ["preparing hold", [/\bstill preparing/i, /is a hold/i, /\bre.read/i, /\bnext wake/i]],
  ["unresolved launch", [/\bunresolved state/i, /\bpreserve|retain/i, /\battempt/i]],
  ["question resume", [/\bAXSTACK-QUESTION/, /\banswer once/i, /\bt3_thread_send/, /\bchildThreadId/, /\bresumed runId/i, /\bt3_thread_wait/, /\btimeoutMs:600000/, /\brun watch/i]],
  ["resumed result", [/\bpersist status/i, /\baccept(?:ing)? only/i, /\blatestTerminal/, /\bnewer than/i, /\bquestion run/i, /\bterminal success/i, /\bmatching receipt key\/SHA/i], /\bnot lexical ID order/i],
  ["question summary", [/\boriginal summary/i, /\bstable/i]],
  ["question notification", [/\bnotification/i], /\bno notification/i],
  ["same writer repair", [/\brepair/i, /\bt3_thread_send/, /\bmode:queue/, /\bsame author/i, /\bsame attempt/i, /\bworktree/i]],
  ["repair revision", [/\bpin/i, /\bnew candidate revision/i]],
  ["replacement attempt", [/\breplacement/i, /\bterminal failure/i, /\ba<n\+1>/, /\bnew branch/i, /\btitle/i]],
  ["failed branch salvage", [/\bfailed attempt/i, /\bbranch/i, /\bkept/i, /\buntil salvage/i]],
  ["unknown writer liveness", [/\bunknown/i, /\bliveness/i, /\b(?:holds?|held)\b/i, /\breplacement/i]],
  ["replacement reconcile", [/\breconcile/i, /\bold writer/i, /\bbefore/i, /\banother/i]],
  ["idle writer watch", [/\bunsettled launched thread/i, /\bturn/i, /\bend only/i, /\bschedule_task/, /\bbindToCurrentThread:true/, /\beveryMs:600000/, /\barmed/i, /\bID recorded/i]],
  ["watch reconcile", [/\beach wake/i, /\breconcile all unsettled runs/i, /\bwriter/i, /\bdied/i, /\bwithout sending|silently/i]],
  ["watch failure", [/\bfailed runs/i, /\b(?:holds?|held)\b/i, /incomplete work/i]],
  ["watch deletion", [/\bnothing/i, /\bunsettled/i, /\bdelete_scheduled_task/, /\blist_scheduled_tasks/, /\bread.back/i, /\babsence/i]],
  ["uncertain watch deletion", [/\buncertain delete/i, /\bpreserve|retain/i, /\b(?:holds?|held)\b/i, /\brecorded ID/i]],
  ["safe deletion in briefs", [/\bput|include/i, /\bsafe.deletion rule/i, /\bevery worker brief/i]],
  ["named private evidence", [/\bname|identify/i, /\bprivate/i, /<run>\/evidence\/<key>\//, /\bbrief/i, /\bcompletion receipt/i]],
  ["temporary evidence guard", [/\bbefore/i, /\buse/i, /\bcleanup/i, /\bTMPDIR/, /0700/, /\bowned/i, /\breal path/i, /inside/i, /\brecorded run evidence/i, /\bowner/i], /\bno symlink/i],
  ["worktree path guards", [/\bequivalent guards/i, /\bworktree.local paths/i]],
  ["cache evidence", [/incidental caches/i, /\bevidence/i], /\bnot/i],
  ["brief confirmation", [/\bdispatching owner/i, /\bconfirm/i, /\bbrief question once/i, /\bexisting authority/i, /\bre.verify/i, /\bstarted/i]],
  ["second brief hold", [/\bsecond/i, /\bask/i, /\b(?:holds?|held)\b/i]],
  ["prompt recovery evidence", [/\bpreserve/i, /\battempt/i, /inspect/i, /\bnative state/i, /\bbefore/i, /\bauthorized recovery/i]],
  ["review evidence isolation", [/\beach reviewer/i, /\bseparate checkout/i, /\bprivate evidence folder/i], /\bno first-pass cross-read/i],
  ["review tracked files", [/\btracked candidate files/i, /\bread.only/i]],
  ["review evidence readback", [/\bread.back/i, /\breport/i, /\bsupporting evidence/i, /\bbefore/i, /\bremoving/i, /\bcheckout/i]],
  ["external evidence", [/\bevidence/i, /\boutside/i, /\barchive/i], /\bno archive/i],
  ["untracked retention", [/\buntracked files/i, /\bworktree/i, /\bdisposable/i, /\bprov|establish/i], /\bnever|cannot/i],
  ["acceptance distinct from start", [/input acceptance/i, /\bstarted state/i, /\beffective settings/i, /\bcompleted work/i, /\bdistinct evidence/i]],
  ["silence exit", [/\bsilence/i, /\bcontact loss/i, /idle state/i, /\bprov\w*|establish/i, /\bexit/i], /\bnever/i],
  ["resume ownership", [/\bordinary resume/i, /\bsame owner/i, /\bauthor/i, /\battempt/i, /\bworktree/i, /\brevisions/i, /\bpending receipts/i]],
  ["uncertain replacement", [/\buncertainty/i, /\b(?:holds?|held)\b/i, /\breplacement/i]],
  ["ownership transfer", [/\bexplicit user transfer/i, /\brecipient acceptance/i, /\bsession/i, /\bscope/i, /\brevision/i, /\bauthority/i, /\bbefore/i, /\bownership/i]],
  ["current owner accountability", [/\bcurrent owner/i, /\baccountab\w*/i, /\buntil then/i]],
  ["prior owner stop", [/\bprior owner/i, /\bstops/i, /\bafter acceptance/i]],
  ["transfer receipt boundary", [/input acceptance/i, /\bturn start alone/i, /\btransfer receipt/i], /\bno transfer receipt|cannot be a transfer receipt/i],
  ["runtime identity mismatch", [/\bT3/, /\bthreadId\/runId/, /\bmismatch/i, /\bstop consuming/i, /\breconcile/i, /\bdriver identity/i, /\bnative state/i]],
  ["identity forgery", [/\bforg\w*/i, /\bsender/i, /\bborrow\w*/i, /identity/i, /\bbypass/i, /\bmismatch/i], /\bnever/i],
  ["user takeover retention", [/\bdriver/i, /\bretain|retention/i, /\buser.taken.over T3 thread/i]],
  ["user takeover cleanup", [/\bcleanup commands/i, /\bt3_thread_organize/, /\bsettle/i, /\barchive/i], /\bnever send/i],
  ["T3 settle evidence", [/\brequir/i, /\bT3 terminal run evidence/i, /\bbefore/i, /\bt3_thread_organize/, /\bsettle/i, /\barchive/i]],
  ["T3 metadata boundary", [/\bmetadata actions/i, /\bworktree removal/i], /\bnot/i],
  ["cleanup preflight", [/\bworktreeCleanup/, /\boff/, /\bevery Axstack project/i]],
  ["cleanup readback", [/\bpreflight/i, /\bt3_project_read/, /\bwhere exposed/i]],
  ["cleanup limitation", [/\botherwise/i, /\brecord/i, /\blimitation/i, /\bdocumented/i, /installation setup step/i]],
  ["cleanup evidence priority", [/\bautomatic worktree deletion/i, /\bevidence readback/i, /\bsalvage/i], /\bcannot replace|no substitute for/i],
  ["run record", [/\brun record/i, /\bdriver threadId/, /\bprojectId/, /\bhost/i, /\bT3 version/, /installed Axstack SHA/, /\bcapabilities JSON path/, /\bscheduledTaskIds/, /\bwatch/i, /\bmanager schedule/i]],
  ["dispatch target record", [/\bper dispatch/i, /\brecord/i, /\bkey/i, /\bmechanism/i, /\brequested target/i, /\bread.back/i]],
  ["dispatch identity record", [/\btaskId\/childThreadId\/childRunId/, /\bthreadId\/runId\/worktree\/branch\/base SHA/]],
  ["dispatch revision record", [/\bcheckout path/i, /\bcandidate/i, /\bbase SHAs/i]],
  ["dispatch evidence record", [/\bevidence folder/i, /\bscope\/authority/i, /\bowner/i, /\bpending receipts/i, /\b(?:holds?|held)\b/i, /\bNext/]],
  ["native runtime boundary", [/\bboundary/i, /\bAxstack daemon/i, /\bDB/, /\block/i, /\bscheduler/i], /\bno Axstack daemon/i],
  ["publication authority", [/\bprivate evidence/i, /\brequir/i, /\bexplicit publication authority/i, /\bbefore sharing/i]],
  ["receipt authority", [/\breceipts/i, /\bmerge/i, /\brelease/i, /\bpublication/i, /\bmodel.substitution/i, /\bhost.mutation/i, /\bexpanded scope authority/i], /\bno merge/i],
];

// One independently worded editorial fixture per rule. These are instruction
// checks, not proof of runtime compliance or broad semantic understanding.
const rewordings = {
  "capabilities": "The orchestrator_capabilities JSON is saved by the driver, a T3 thread, which follows the schema.",
  "missing capability": "Without a substitute runtime, the affected operation holds for missing capability.",
  "role snapshot": "Source, time and resolved ID accompany the requested settings and stable role IDs in a snapshot of the selected preset from roles.json.",
  "snapshot resume": "With no re-resolution, the snapshot is preserved on resume.",
  "snapshot change": "The user's explicit decision is required for changes.",
  "provider mapping": "Bindings are antigravity→antigravity, grok→grok, claude→claudeAgent and codex→codex.",
  "mode and options": "Use options:[{id,value}] and map modeId into runtimeMode:full-access.",
  "pinned model": "As given, the preset model is used.",
  "class resolution": "For each provider, modelClass resolves the newest catalog entry matching claude-<class>-<N>-<N> or gpt-<N>-<class>.",
  "resolution catalog": "The saved capabilities JSON path is passed to resolve-models.js with --provider.",
  "null model": "Only grok and antigravity, the launch-by-agent-id providers, use the first model from saved capabilities for a model:null role lacking a class.",
  "null ID receipt": "The exact ID is recorded in place of an unresolved provider default.",
  "antigravity models": "With zero models advertised in saved capabilities, Antigravity is held.",
  "intentional model absence": "Intentional absence holds a role lacking both model and class for claude or codex.",
  "absent provider default": "For that role, never use a provider default.",
  "catalog hold": "Resolution holds for a malformed or missing catalog.",
  "no alternative on failure": "An alternative is never selected for rejection, timeout, quota or auth.",
  "absent seats": "Recorded absences are retained for intentional absent seats.",
  "runtime availability": "Runtime proof establishes availability.",
  "codex effort": "Option ID reasoningEffort supplies Codex effort.",
  "claude effort": "Option ID effort supplies Claude effort.",
  "grok effort": "Exclude max for Grok using reasoningEffort.",
  "Grok CLI floor": "The CLI must satisfy ≥1.0.13.",
  "Grok readiness proof": "That its CLI runs cannot be established by Grok advertising alone.",
  "opencode effort": "With no OpenCode role enters this migration, OpenCode effort uses variant.",
  "binding echo": "The requested model and provider match the dispatch echo.",
  "binding readback": "Read-back through t3_thread_configuration must verify runtimeMode and options.",
  "separate binding evidence": "Keep effective and requested values in separate records.",
  "worker proof": "Configuration proof is never a worker self-report.",
  "missing effort readback": "Roles needing effort hold on missing effort read-back.",
  "effort satisfaction": "Never record it as satisfied.",
  "other effort limitation": "Until tested, effort read-back for other providers stays unverified.",
  "first configuration canary": "Before siblings launch, the first dispatch of a provider, model and effort reaches a completed or running run.",
  "canary rejection": "Siblings for that configuration are blocked by rejection.",
  "unrelated configurations": "Eligible configurations include unrelated configurations.",
  "read-only delegates": "In the driver worktree, advisers, diligence and research use async delegate_task with title = dispatch key.",
  "delegate untouched": "Untracked and tracked files remain untouched.",
  "delegate evidence": "The delegate writes only <run>/evidence/<key>/.",
  "probe delegates": "UI verifier, execution investigators, debug investigators and reviewers use async delegate_task with title = dispatch key.",
  "probe checkout": "Use git worktree add --detach for a disposable detached checkout pinned to candidate SHA and pinned base.",
  "probe cd": "Into it the brief requires cd.",
  "probe outputs": "Only disposable probes write there, and outputs go to <run>/evidence/<key>/.",
  "writer launch": "Until the PR merges or closes, author and code-arena retain their own worktree, launched by t3_thread_launch with startFromOrigin:false and type:worktree.",
  "owner row": "The Owner is the Driver thread in the Driver worktree.",
  "owner source exclusion": "Tracked files are never edited.",
  "owner worker exclusion": "No worker launch applies.",
  "idle ownership": "Ownership never transfers because a session is missing or idle.",
  "driver preset exclusion": "In any preset, the current driver has no role entry.",
  "key and title": "Before launch, record dispatch key <run>:<role>:<task>:a<n> as the exact whole T3 title.",
  "substring identity": "Identity is not established by substring matches.",
  "branch naming": "Use axstack/<run>/<role>/<task>-a<n> as the branch.",
  "branch encoding": "Replace [^a-z0-9-] with - and lowercase each segment.",
  "dispatch original": "Record both while retaining the dispatch key in its original form.",
  "normalization identity": "An identity substitute is never normalization.",
  "pinned dispatch revisions": "Before dispatch, pin the candidate and base.",
  "receipt protocol": "Workers provide exactly one final marker, AXSTACK-QUESTION key= q=, AXSTACK-FAILED key= head= report=, or AXSTACK-DONE key= head= report=.",
  "report identity": "Absolute private evidence paths are used in reports.",
  "report-only head": "The pinned candidate SHA is the report-only head.",
  "writer delivery": "Through t3_thread_send, launched writers send the marker to the recorded driver thread.",
  "delegate delivery": "In their final result, delegated children leave the receipt.",
  "delegate completion": "Terminal completed with AXSTACK-DONE, hasPendingChildRuns:false and result_available is required for delegated completion.",
  "question incomplete": "Even if completed, a question remains incomplete.",
  "writer completion": "Launched writer completion requires terminal t3_thread_wait before checks for red/green logs, clean tree and non-empty diff.",
  "message progress": "Only progress is proved by a receipt message alone.",
  "current completion": "The candidate SHA and current attempt key govern completion.",
  "stale completion": "A newer attempt is never completed by an older attempt.",
  "stale receipt evidence": "Stale or duplicate receipts are kept as evidence, deduplicated by runtime identity.",
  "delivery validation": "Before acknowledgment, process the whole delivery and advance only after checking artifacts, scope and sender.",
  "failure classification": "Preserved evidence and an incomplete outcome apply to AXSTACK-FAILED, preparing thread error, failed or interrupted run or task_status failed.",
  "silence completion": "Successful completion is never established by silence.",
  "launch recovery inventory": "For a lost launch response combine git worktree list and fully paginated t3_thread_list titleContains=<key>, filtered by exact whole-title equality.",
  "reserved branch": "Through recovery keep the reserved branch.",
  "unreconciled worktree": "Proof of absence is prevented by a branch or worktree without a reconciled thread.",
  "launch recovery outcomes": "In recovery, adopt one exact match only after branch and worktree agree.",
  "relaunch absence": "With the same reserved key and branch, relaunch once on proven absence.",
  "recovery hold": "Hold on incomplete inventory, second uncertain response, conflicts or several matches.",
  "silence duplicate": "Silence never justifies launching a duplicate writer.",
  "post-launch wait": "Post-launch, the driver calls t3_thread_wait timeoutMs:120000 and classifies failed as launch failure.",
  "timed-out started": "Started is established on timed-out when t3_thread_read shows worktreePath and activeRunId.",
  "preparing hold": "Still preparing is a hold, to re-read at the next wake.",
  "unresolved launch": "The attempt is retained in unresolved state.",
  "question resume": "For AXSTACK-QUESTION, answer once via t3_thread_send to childThreadId, recording resumed runId then t3_thread_wait timeoutMs:600000 re-armed by run watch.",
  "resumed result": "Persist status before accepting only latestTerminal* with terminal success and matching receipt key/SHA, newer than the question run by recorded ordering, not lexical ID order.",
  "question summary": "Stable is the original summary.",
  "question notification": "No notification is assumed.",
  "same writer repair": "A repair uses t3_thread_send mode:queue in the same worktree, same attempt and same author.",
  "repair revision": "The new candidate revision is pinned.",
  "replacement attempt": "After terminal failure, replacement uses a<n+1>, a new title and new branch.",
  "failed branch salvage": "Until salvage, the failed attempt's branch is kept.",
  "unknown writer liveness": "Replacement holds when there is unknown liveness.",
  "replacement reconcile": "Before another writer, reconcile the old writer.",
  "idle writer watch": "With an unsettled launched thread, the turn can end only with schedule_task bindToCurrentThread:true everyMs:600000 armed and ID recorded.",
  "watch reconcile": "Each wake must reconcile all unsettled runs, including a writer that died silently.",
  "watch failure": "Incomplete work is held when failed runs occur.",
  "watch deletion": "When nothing is unsettled, delete_scheduled_task and read back absence with list_scheduled_tasks.",
  "uncertain watch deletion": "The hold and recorded ID are retained on an uncertain delete.",
  "safe deletion in briefs": "In every worker brief, include the Safe-deletion rule.",
  "named private evidence": "In the completion receipt and brief, identify the private <run>/evidence/<key>/ folder.",
  "temporary evidence guard": "Before cleanup or use, TMPDIR must be a 0700 owned folder with no symlink, matching the owner, its real path inside recorded run evidence.",
  "worktree path guards": "For worktree-local paths, apply equivalent guards.",
  "cache evidence": "Evidence is not incidental caches.",
  "brief confirmation": "The dispatching owner must re-verify started after confirming the brief question once and restating existing authority.",
  "second brief hold": "A second ask holds.",
  "prompt recovery evidence": "Before authorized recovery, inspect native state and preserve the attempt.",
  "review evidence isolation": "Each reviewer receives a private evidence folder and separate checkout with no first-pass cross-read.",
  "review tracked files": "Read-only are the tracked candidate files.",
  "review evidence readback": "Before removing that checkout, read back supporting evidence and report.",
  "external evidence": "No archive is needed for evidence outside it.",
  "untracked retention": "A worktree is never proven disposable by its untracked files.",
  "acceptance distinct from start": "Distinct evidence includes completed work, effective settings, started state and input acceptance.",
  "silence exit": "Exit is never proved by idle state, contact loss or silence.",
  "resume ownership": "Ordinary resume retains pending receipts and revisions with the same owner, author, attempt and worktree.",
  "uncertain replacement": "Replacement holds on uncertainty.",
  "ownership transfer": "Before ownership changes, explicit user transfer validates recipient acceptance against authority, revision, scope and session.",
  "current owner accountability": "Until then, accountability remains with the current owner.",
  "prior owner stop": "After acceptance, the prior owner stops.",
  "transfer receipt boundary": "Turn start alone or input acceptance cannot be a transfer receipt.",
  "runtime identity mismatch": "With a T3 threadId/runId mismatch, stop consuming and reconcile the driver identity with native state.",
  "identity forgery": "Never bypass the mismatch by borrowing an identity or forging a sender.",
  "user takeover retention": "A user-taken-over T3 thread is retained by the driver.",
  "user takeover cleanup": "Never send cleanup commands to it, including t3_thread_organize settle or archive.",
  "T3 settle evidence": "Before t3_thread_organize settle or archive, require T3 terminal run evidence.",
  "T3 metadata boundary": "Worktree removal is not performed by these metadata actions.",
  "cleanup preflight": "For every Axstack project worktreeCleanup is off.",
  "cleanup readback": "Where exposed, preflight uses t3_project_read.",
  "cleanup limitation": "Otherwise, record a limitation pointing to the documented installation setup step.",
  "cleanup evidence priority": "Automatic worktree deletion cannot replace salvage and evidence readback.",
  "run record": "Host, driver threadId, projectId, T3 version, installed Axstack SHA, capabilities JSON path and scheduledTaskIds for each watch and manager schedule belong in the run record.",
  "dispatch target record": "Per dispatch, requested target, read-back, mechanism and key appear in the record.",
  "dispatch identity record": "Use taskId/childThreadId/childRunId or threadId/runId/worktree/branch/base SHA.",
  "dispatch revision record": "Base SHAs and candidate accompany the checkout path.",
  "dispatch evidence record": "Next and hold join pending receipts, owner, scope/authority and evidence folder.",
  "native runtime boundary": "The boundary has no Axstack daemon, DB, lock or scheduler.",
  "publication authority": "Before sharing, private evidence requires explicit publication authority.",
  "receipt authority": "Receipts grant no merge, release, publication, model-substitution, host-mutation or expanded scope authority.",
};

const accepts = (text, [, concepts, prohibition]) => prohibition
  ? prohibits(text, prohibition, ...concepts)
  : requires(text, ...concepts);

// One generic token-negation inversion per sentence, with a scoped negation
// for declarative instructions that have no directive or negative token.
const negate = (text) => {
  const tokens = { must: 'must not', shall: 'shall not', require: 'do not require',
    requires: 'does not require', required: 'not required', never: 'always',
    always: 'never', no: 'some', not: 'indeed', cannot: 'can', without: 'with' };
  const pattern = /\b(must|shall|requires?|required|never|always|no|not|cannot|without)\b/i;
  return pattern.test(text)
    ? text.replace(pattern, (token) => tokens[token.toLowerCase()])
    : `Do not follow this instruction: ${text}`;
};

for (const rule of rules) {
  const [name] = rule;
  test(`T3 instruction: ${name}`, () => {
    const source = sentences(runtime());
    const matching = source.filter((sentence) => accepts(sentence, rule));
    expect(matching.length, name).toBeGreaterThan(0);
    expect(accepts(source.filter((sentence) => !matching.includes(sentence)).join('. '), rule), name).toBe(false);
    const rewording = rewordings[name];
    expect(accepts(rewording, rule), rewording).toBe(true);
    for (const sentence of [...matching, rewording]) {
      expect(accepts(negate(sentence), rule), negate(sentence)).toBe(false);
    }
  });
}

// Each AC2 expected action shares its concepts with the corresponding rule
// paragraph; the instruction checks above independently cover the rules.
const recovery = {
  'lost-launch-response': [
    [/lost launch response/i, [/ke(?:ep|pt)/i, /reserved branch/i]],
    [/recovery must adopt/i, [/adopt/i, /one exact match/i, /relaunch once/i, /proven absence/i, /incomplete inventory/i, /hold/i]],
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
    [/driver must persist task_status/i, [/persist/i, /task_status/, /before/i, /t3_thread_read|thread reads/i]],
    [/launched writer completion/i, [/require/i, /terminal/i]],
  ],
  'child-question-resume': [
    [/AXSTACK-QUESTION.*answer once/is, [/t3_thread_send/, /childThreadId/, /600000/, /watch/i, /latestTerminal/, /newer than/i, /question run/i]],
  ],
};

test('AC2 recovery actions match their rule paragraphs', () => {
  const scenarios = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json'));
  expect(scenarios.cases.slice(0, 5).map(({ id }) => id)).toEqual(Object.keys(recovery));
  const paragraphs = runtime().split(/\n\s*\n/);
  for (const scenario of scenarios.cases.slice(0, 5)) {
    expect(scenario.input).toBeTruthy();
    for (const name of scenario.contracts) {
      expect([...pins, ...rules].some(([ruleName]) => name === ruleName), name).toBe(true);
    }
    for (const [locator, concepts] of recovery[scenario.id]) {
      const paragraph = paragraphs.find((text) => locator.test(text));
      expect(paragraph, scenario.id).toBeDefined();
      for (const pattern of concepts) {
        expect(pattern.test(scenario.expected.action), scenario.id + ': action').toBe(true);
        expect(pattern.test(paragraph), scenario.id + ': rule').toBe(true);
      }
    }
  }
});

test('prohibits remains stateless for global expressions', () => {
  const prohibition = /no glob/gi;
  expect(prohibits('No glob.', prohibition, /missing/)).toBe(false);
  expect(prohibits('No glob.', prohibition, /glob/)).toBe(true);
  expect(prohibits('No glob.', prohibition, /glob/)).toBe(true);
});
