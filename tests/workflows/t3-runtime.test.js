import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { sentences, requires, prohibits } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const runtime = () => read('skills/axstack/references/t3-runtime.md').replace(/[`*]/g, '').replace(/^#+.*$/gm, '').replace(/\|\n/g, '|.\n');
// Concepts co-occur in one sentence; temporal and actor relations below also
// constrain their direction. Negative rules state their prohibition explicitly.
// A before B / B after A, including fronted "Before B, A" and "After A, B".
// "Then" and "and" preserve command order in the few source instructions
// that express sequence without a before/after token.
const gap = '(?:(?!\\b(?:before|after|until|once|then)\\b)[^.;])*';
const before = (a, b) => new RegExp(`(?:${a})${gap}\\b(?:before|then|and)\\b${gap}(?:${b})|(?:${b})${gap}\\bafter\\b${gap}(?:${a})|^\\s*before${gap}(?:${b})${gap}(?:,)?${gap}(?:${a})|^\\s*after${gap}(?:${a})${gap}(?:,)?${gap}(?:${b})`, 'i');
const until = (state, end) => new RegExp(`(?:${state})${gap}\\buntil\\b${gap}(?:${end})|^\\s*until${gap}(?:${end})${gap}(?:,)?${gap}(?:${state})`, 'i');
const once = (condition, action) => new RegExp(`\\b(?:once|when)\\b${gap}(?:${condition})${gap}(?:${action})|(?:${action})${gap}\\bonce\\b${gap}(?:${condition})`, 'i');
const relations = {
  'other effort limitation': until('unverified', 'exercised|tested'),
  'first configuration canary': before('first dispatch[^.;]*(?:running|completed)', 'siblings'),
  'writer launch': until('own worktree', 'merg[^.;]*or clos'),
  'key and title': before('record', 'launch'),
  'pinned dispatch revisions': before('pin[^.;]*(?:base[^.;]*candidate|candidate[^.;]*base)', 'dispatch'),
  'status persistence': before('persist[^.;]*task_status', 't3_thread_read'),
  'whole status': before('save[^.;]*whole response', 'consum|expand'),
  'writer completion': before('terminal[^.;]*t3_thread_wait', 'candidate checks|non.empty diff'),
  'delivery validation': before('process[^.;]*whole delivery', 'acknowledgment'),
  'delegated isolation': before('delegated completion', 'driver[^.;]*(?:check|compares)'),
  'isolation hold': before('hold', 'advanc'),
  'launch recovery outcomes': before('worktree[^.;]*branch[^.;]*agree|branch[^.;]*worktree[^.;]*agree', 'adopt'),
  'question resume': before('answer once[^.;]*resumed runId', 't3_thread_wait'),
  'resumed result': before('persist status', 'accept'),
  'replacement attempt': before('terminal failure', 'replacement'),
  'failed branch salvage': until('kept', 'salvage'),
  'replacement reconcile': before('reconcile[^.;]*old writer', 'another'),
  'watch deletion': once('nothing[^.;]*unsettled', 'delete_scheduled_task'),
  'temporary evidence guard': before('TMPDIR[^.;]*owner', 'use|cleanup'),
  'brief confirmation': before('confirm[^.;]*brief question once', 're.verif[^.;]*started'),
  'prompt recovery evidence': before('inspect[^.;]*native state', 'authorized recovery'),
  'review evidence readback': before('read back[^.;]*(?:report[^.;]*evidence|evidence[^.;]*report)', 'remov[^.;]*checkout'),
  'ownership transfer': before('recipient acceptance[^.;]*authority|recipient acceptance[^.;]*session', 'ownership'),
  'current owner accountability': until('accountab', 'then'),
  'prior owner stop': before('acceptance', 'prior owner[^.;]*stop'),
  'T3 settle evidence': before('requir[^.;]*T3 terminal run evidence', 't3_thread_organize'),
  'publication authority': before('private evidence[^.;]*explicit publication authority|explicit publication authority[^.;]*private evidence', 'sharing'),
};
// Actor responsibilities require a grammatical subject or an explicit passive
// agent, rather than a mention elsewhere in the instruction.
const subjects = {
  'human merge authority': /^(?:the )?human\s+merg|\bmerg\w*[^.;]*\bby the human\b|^by default[,]?\s+(?:the )?human\s+merg/i,
  'driver ownership': /^(?:the )?driver\b[^.;]*sole run.record writer|\bby the driver\b[^.;]*sole run.record writer|sole run.record writer[^.;]*\bby the driver\b/i,
  'driver source exclusion': /^(?:the )?driver\b|^it\b|\bby the driver\b/i,
  'repair ownership': /\brepair\w*[^.;]*\b(?:return\w*|go(?:es)? back)\s+to (?:that|the same) author\b/i,
  'stale completion': /\bolder attempt\s+(?:is\s+)?never\s+complet\w*[^.;]*\bnewer\b|\bnewer attempt\s+is never completed by an older attempt\b/i,
  'delegate untouched': /^(?!.*\bfiles?\s+(?:change|changed|writ))[^.;]*(?:(?:\btracked[^.;]*\buntracked|\buntracked[^.;]*\btracked)[^.;]*\buntouched|\btracked files[^.;]*untouched alongside untracked files)/i,
  'question incomplete': /\bquestion\s+(?:stays|remains|is)\s+incomplete\b/i,
  'reserved branch': /^(?!.*(?:\bonly until\b|\buntil recovery begins\b))[^.;]*\b(?:ke(?:ep|pt)[^.;]*reserved branch|reserved branch[^.;]*ke(?:ep|pt))[^.;]*\bthrough(?:out)?\s+recovery\b|\bthrough recovery\s+keep[^.;]*reserved branch/i,
  'review tracked files': /^(?!.*\bwritable\b)[^.;]*read.only/i,
};
const invertedState = /\b(?:un(?:completed|running|preserved|required|stable|kept|owned|validated|armed)|in(?:eligible|exact)|oldest|writable)\b|\breleas\w*[^.;]*\bhold\b/i;
const accepts = (text, [name, concepts, prohibition]) => sentences(text).some((sentence) =>
  !invertedState.test(sentence)
  && (!relations[name] || relations[name].test(sentence))
  && (!subjects[name] || subjects[name].test(sentence))
  && (!actorRules.has(name) || !/rather than the (?:human|driver|author|owner|reviewers?|writers|children|user)\b/i.test(sentence))
  && (prohibition ? prohibits(sentence, prohibition, ...concepts) : requires(sentence, ...concepts)));
const rules = [
  ['capabilities', [/\bdriver/i, /\bT3 thread/i, /\bsav\w*/i, /\borchestrator_capabilities/, /\bJSON/, /\bschema/i]],
  ['missing capability', [/\bmissing capability/i, /\b(?:holds?|held)\b/i, /\baffected operation/i], /\bwithout a substitute runtime/i],
  ['role snapshot', [/\broles.json/, /\bsnapshot/i, /\bpreset/i, /\bstable role IDs/i, /\brequested/i, /\bresolved/i, /\bsource/i, /\btime/i]],
  ['snapshot resume', [/\bresume/i, /\bsnapshot/i], /\bno re-resolution/i],
  ['snapshot change', [/\bchanges/i, /\brequir/i, /\buser/i, /\bexplicit decision/i]],
  ['provider mapping', [/\bbindings/i, /\bcodex→codex/, /\bclaude→claudeAgent/, /grok→grok/, /\bantigravity→antigravity/]],
  ['mode and options', [/\bmodeId/, /\bruntimeMode:full-access/, /\boptions:\[\{id,value\}\]/]],
  ['pinned model', [/\bpreset model/i, /\bused|use/i, /\bas given/i]],
  ['class resolution', [/\bmodelClass/, /\bresol(?:v|ution)/i, /\bnewest/i, /\bprovider/i, /gpt-<N>-<class>/, /\bclaude-<class>-<N>-<N>/]],
  ['resolution catalog', [/\bresolve-models.js/, /--provider/, /\bsaved capabilities JSON path/i]],
  ['catalog hold', [/\bmissing|malformed/i, /\bcatalog/i, /\b(?:holds?|held)\b/i, /\bresolution/i]],
  ['null model', [/\bmodel:null/, /\bfirst model/i, /\bprovider/i, /\bsaved capabilities/i], /\bno class/i],
  ['null ID receipt', [/\brecord/i, /\bexact ID/i, /\bunresolved provider default/i]],
  ['availability hold', [/\bunavailable/i, /\bprovider/i, /\bmodel/i, /\brole/i, /\bmode/i, /\beffort/i, /\b(?:holds?|held)\b/i], /\bno substitution/i],
  ['no alternative on failure', [/\bauth/i, /\bquota/i, /\btimeout/i, /\breject/i, /\balternative/i], /\bdo not select|never select/i],
  ['absent seats', [/intentional/i, /\babsent seats/i, /\brecorded absences/i]],
  ['runtime availability', [/\bavailability/i, /\bruntime proof/i]],
  ['codex effort', [/\bcodex/i, /\beffort/i, /\boption ID/i, /\breasoningEffort/]],
  ['claude effort', [/\bclaude/i, /\beffort/i, /\boption ID/i, /\beffort/i]],
  ['grok effort', [/grok/i, /\breasoningEffort/, /\bexclud/i, /\bmax/i]],
  ['Grok CLI floor', [/\bCLI/, /\brequir|must/i, /≥1\.0\.13/]],
  ['Grok readiness proof', [/grok/i, /\balone/i, /\bprove|establish/i, /\bCLI/i, /\bruns/i], /\bdoes not|cannot/i],
  ['opencode effort', [/\bopencode/i, /\beffort/i, /\bvariant/], /\bno OpenCode role enters this migration/i],
  ['binding echo', [/\bdispatch echo/i, /\bmatch/i, /\brequested/i, /\bprovider/i, /\bmodel/i]],
  ['binding readback', [/\bverif/i, /\boptions/i, /\bruntimeMode/, /\bt3_thread_configuration/, /\bread.back/i]],
  ['separate binding evidence', [/\brecord|ke(?:ep|pt)/i, /\brequested/i, /\beffective/i, /\bseparat/i]],
  ['worker proof', [/\bworker self.report/i, /\bconfiguration proof/i], /\bnot|never/i],
  ['missing effort readback', [/\bmissing effort read.back/i, /\b(?:holds?|held)\b/i, /\broles/i, /\beffort/i]],
  ['effort satisfaction', [/\brecord/i, /\bsatisfied/i], /\bnever (?:be )?record/i],
  ['other effort limitation', [/\bother providers/i, /\beffort read.back/i, /\bunverified/i, /\bexercised|tested/i]],
  ['first configuration canary', [/\bfirst dispatch/i, /\bprovider/i, /\bmodel/i, /\beffort/i, /\brunning/i, /\bcompleted/i, /\bbefore/i, /\bsiblings/i]],
  ['canary rejection', [/\breject/i, /\bstop|block/i, /\bsiblings/i, /\bconfiguration/i]],
  ['unrelated configurations', [/\bunrelated configurations/i, /\beligible|\badmissible/i]],
  ['read-only delegates', [/\badvisers/i, /\bresearch/i, /\bdiligence/i, /\bdelegate_task/, /\basync/i, /\bdriver worktree/i, /\btitle = dispatch key/i]],
  ['delegate untouched', [/\btracked/i, /\buntracked/i, /\bfiles/i, /\buntouched/i]],
  ['delegate evidence', [/\bwrites only/i, /<run>\/evidence\/<key>\//]],
  ['probe delegates', [/\breviewers/i, /\bdebug investigators/i, /\bexecution investigators/i, /\bUI verifier/i, /\bdelegate_task/, /\basync/i, /\btitle = dispatch key/i]],
  ['probe checkout', [/\bdisposable/i, /\bdetached/i, /\bcandidate SHA/i, /\bpinned base/i, /git worktree add --detach/]],
  ['probe cd', [/\bbrief/i, /\brequir/i, /\bcd/i, /into it/i]],
  ['probe outputs', [/\bdisposable probes/i, /\boutputs/i, /<run>\/evidence\/<key>\//]],
  ['writer launch', [/\bauthor/i, /\bcode-arena/i, /\bt3_thread_launch/, /\btype:worktree/, /\bstartFromOrigin:false/, /\bown worktree/i, /\bmerges or closes/i]],
  ['owner row', [/\bowner/i, /\bdriver thread/i, /\bdriver worktree/i]],
  ['owner source exclusion', [/\btracked files/i], /\bnever (?:writes|edits|changes) tracked files|never (?:be )?(?:written|edited|changed)/i],
  ['owner worker exclusion', [/\bworker launch/i], /\bNo worker launch/i],
  ['driver ownership', [/\bdriver/i, /\bsole run.record writer/i, /\bone writer per candidate/i]],
  ['driver source exclusion', [/\btracked files/i, /\brepair/i, /\bauthor/i, /\bsource/i], /\bnever writes/i],
  ['repair ownership', [/\brepair/i, /\breturn|go(?:es)? back/i, /\bthat author|same author/i]],
  ['idle ownership', [/\bmissing/i, /idle/i, /\bsession/i, /\bownership/i, /\btransfer/i], /\bno ownership transfer|never (?:grant ownership transfer|transfers?)/i],
  ['driver preset exclusion', [/\bcurrent/i, /\bchat\/driver|driver/i, /\bpreset/i, /\brole/i, /\brow|entry/i], /\bno (?:role (?:row|entry)|preset)/i],
  ['key and title', [/\bdispatch key/i, /<run>:<role>:<task>:a<n>/, /\bbefore/i, /\blaunch/i, /\bexact whole/i, /\bT3 title/i]],
  ['substring identity', [/\bsubstring matches/i, /\bestablish/i, /identity/i], /\bdo not|not/i],
  ['branch naming', [/\bbranch/i, /\baxstack\/<run>\/<role>\/<task>-a<n>/]],
  ['branch encoding', [/\blowercas/i, /\beach segment/i, /\breplace/i, /\[\^a-z0-9-\]/, /\bwith -/]],
  ['dispatch original', [/\bdispatch key/i, /\boriginal form/i, /\bboth/i, /\brecord/i]],
  ['normalization identity', [/\bnormalization/i, /identity substitute/i], /\bnever/i],
  ['SHA baseRef', [/\bbaseRef/, /\bbranch name/i], /\bnever (?:be )?a branch name|never be used as baseRef/i],
  ['baseRef commit', [/\balways (?:be |use )?a commit SHA/i], /\bnever a branch name|^(?!.*branch name)/i],
  ['pinned dispatch revisions', [/\bpin/i, /\bbase/i, /\bcandidate/i, /\bbefore/i, /\bdispatch/i]],
  ['receipt protocol', [/\bworkers/i, /\bexactly one final marker/i, /\bAXSTACK-DONE key=/, /\bhead=/, /\breport=/, /\bAXSTACK-FAILED key=/, /\bAXSTACK-QUESTION key=/, /\bq=/]],
  ['report identity', [/\breports/i, /\babsolute/i, /\bprivate evidence paths/i]],
  ['report-only head', [/\breport.only head/i, /\bpinned candidate SHA/i]],
  ['writer delivery', [/\blaunched writers/i, /\bmarker/i, /\bt3_thread_send/, /\brecorded driver thread/i]],
  ['delegate delivery', [/\bdelegated children/i, /\bfinal result/i]],
  ['status persistence', [/\bdriver/i, /\bpersist/i, /\btask_status/, /\bprivate evidence/i, /\bbefore/i, /\bt3_thread_read/, /\bdelegated task/i]],
  ['whole status', [/\bsave/i, /\bwhole response/i, /\bbefore/i, /\bconsum|expand/i, /\bresult/i]],
  ['delegate completion', [/\bdelegated completion/i, /\brequir/i, /\bterminal/i, /\bcompleted/, /\bresult_available/, /\bhasPendingChildRuns:false/, /\bAXSTACK-DONE/]],
  ['question incomplete', [/\bquestion/i, /incomplete/i, /\bcompleted/i]],
  ['writer completion', [/\blaunched writer completion/i, /\brequir/i, /\bterminal/i, /\bt3_thread_wait/, /\bnon.empty diff/i, /\bclean tree/i, /\bred\/green/i]],
  ['message progress', [/\breceipt message alone/i, /\bonly/i, /\bprogress/i]],
  ['current completion', [/\bcompletion/i, /\bcurrent attempt key/i, /\bcandidate SHA/i]],
  ['stale completion', [/\bolder attempt/i, /\bcomplet\w*/i, /\bnewer/i], /\bnever/i],
  ['stale receipt evidence', [/\bstale/i, /\bduplicate receipts/i, /\bevidence/i, /\bdeduplicated/i, /\bruntime identity/i]],
  ['delivery validation', [/\bwhole delivery/i, /\bbefore/i, /\backnowledgment/i, /\badvance only after/i, /\bsender/i, /\bscope/i, /\bartifacts/i]],
  ['failure classification', [/\btask_status failed/, /\bfailed or interrupted/i, /\bpreparing thread error/i, /\bAXSTACK-FAILED/, /incomplete outcome/i, /\bpreserved evidence/i]],
  ['silence completion', [/\bsilence/i, /\bsuccessful completion/i], /\bnot|never/i],
  ['delegated isolation', [/\bafter each delegated completion/i, /\bdriver/i, /\bHEAD/, /git status --porcelain/, /\bpre-dispatch/i, /\bunchanged/i, /\buntracked/i]],
  ['isolation hold', [/\bany change/i, /is a hold/i, /\bbefore/i, /\badvancing/i]],
  ['launch recovery inventory', [/\blost launch response/i, /\bfully paginated/i, /\bt3_thread_list/, /\btitleContains=<key>/, /\bexact whole.title equality/i, /git worktree list/]],
  ['reserved branch', [/\bke(?:ep|pt)/i, /\breserved branch/i, /\brecovery/i]],
  ['unreconciled worktree', [/\bbranch/i, /\bworktree/i, /\bwithout a reconciled thread/i, /\bprevent\w*/i, /\bproof of absence/i], /\bwithout a reconciled thread/i],
  ['launch recovery outcomes', [/recovery/i, /adopt/i, /one exact match/i, /worktree/i, /branch/i, /agree/i]],
  ['relaunch absence', [/proven absence/i, /relaunch once/i, /same reserved key/i, /branch/i]],
  ['recovery hold', [/several matches/i, /conflicts/i, /second uncertain response/i, /incomplete inventory/i, /hold/i]],
  ['silence duplicate', [/duplicate writer/i, /silence/i, /launch|start|justif/i], /never/i],
  ['post-launch wait', [/post.launch/i, /driver/i, /t3_thread_wait/, /timeoutMs:120000/, /failed/i, /launch failure/i]],
  ['timed-out started', [/timed.out/i, /t3_thread_read/, /activeRunId/, /worktreePath/, /started/i]],
  ['preparing hold', [/still preparing/i, /is a hold/i, /re.read/i, /next wake/i]],
  ['unresolved launch', [/unresolved state/i, /preserve|retain/i, /attempt/i]],
  ['question resume', [/AXSTACK-QUESTION/, /answer once/i, /t3_thread_send/, /childThreadId/, /resumed runId/i, /t3_thread_wait/, /timeoutMs:600000/, /run watch/i]],
  ['resumed result', [/persist status/i, /accept only/i, /latestTerminal/, /newer than/i, /question run/i, /terminal success/i, /matching receipt key\/SHA/i], /not lexical ID order/i],
  ['question summary', [/original summary/i, /stable/i]],
  ['question notification', [/notification/i], /no notification/i],
  ['same writer repair', [/repair/i, /t3_thread_send/, /mode:queue/, /same author/i, /same attempt/i, /worktree/i]],
  ['repair revision', [/pin/i, /new candidate revision/i]],
  ['replacement attempt', [/replacement/i, /terminal failure/i, /a<n\+1>/, /new branch/i, /title/i]],
  ['failed branch salvage', [/failed attempt/i, /branch/i, /kept/i, /until salvage/i]],
  ['unknown writer liveness', [/unknown liveness/i, /holds/i, /replacement/i]],
  ['replacement reconcile', [/reconcile/i, /old writer/i, /before/i, /another/i]],
  ['idle writer watch', [/unsettled launched thread/i, /turn/i, /end only/i, /schedule_task/, /bindToCurrentThread:true/, /everyMs:600000/, /armed/i, /ID recorded/i]],
  ['watch reconcile', [/each wake/i, /reconcile all unsettled runs/i, /writer/i, /died/i, /without sending|silently/i]],
  ['watch failure', [/failed runs/i, /hold|held/i, /incomplete work/i]],
  ['watch deletion', [/nothing/i, /unsettled/i, /delete_scheduled_task/, /list_scheduled_tasks/, /read back/i, /absence/i]],
  ['uncertain watch deletion', [/uncertain delete/i, /preserve|retain/i, /hold/i, /recorded ID/i]],
  ['safe deletion in briefs', [/put|include/i, /safe.deletion rule/i, /every worker brief/i]],
  ['named private evidence', [/name|identify/i, /private/i, /<run>\/evidence\/<key>\//, /brief/i, /completion receipt/i]],
  ['temporary evidence guard', [/before/i, /use/i, /cleanup/i, /TMPDIR/, /0700/, /owned/i, /real path/i, /inside/i, /recorded run evidence/i, /owner/i], /no symlink/i],
  ['worktree path guards', [/equivalent guards/i, /worktree.local paths/i]],
  ['uncertain path retention', [/uncertain paths/i, /preserved/i, /reconciliation/i]],
  ['safe deletion', [/deletion/i, /exact validated owned path/i, /evidence/i, /TMPDIR/, /worktree/i, /literal absolute path/i, /\$\{VAR:\?\}/, /no glob/i, /no parent.root deletion/i], /no glob|no parent.root deletion/gi],
  ['glob deletion', [/no glob/i, /no parent.root deletion/i], /no glob|no parent.root deletion/gi],
  ['parent deletion', [/no parent.root deletion/i, /no glob/i], /no glob|no parent.root deletion/gi],
  ['cache deletion', [/general cache/i], /never wipe a general cache/i],
  ['cache evidence', [/incidental caches/i, /evidence/i], /not/i],
  ['brief confirmation', [/dispatching owner/i, /confirm/i, /brief question once/i, /existing authority/i, /re.verify/i, /started/i]],
  ['second brief hold', [/second ask/i, /holds/i]],
  ['prompt refusal', [/answer/i, /trust/i, /permission prompts/i], /never/i],
  ['confirmation authority', [/brief confirmation/i, /no authority/i, /harness/i, /tool dialog/i, /does not answer/i], /no authority|does not answer/gi],
  ['prompt refusal hold', [/permission prompt/i, /provider safety refusal/i, /held/i, /incomplete outcome/i]],
  ['refusal bypass', [/bypass/i, /retry/i, /another model/i], /never/i],
  ['additional prompt holds', [/trust/i, /hook review/i, /authentication/i, /model prompts/i, /hold/i]],
  ['prompt recovery evidence', [/preserve/i, /attempt/i, /inspect/i, /native state/i, /before/i, /authorized recovery/i]],
  ['review evidence isolation', [/each reviewer/i, /separate checkout/i, /private evidence folder/i], /no first-pass cross-read/i],
  ['review tracked files', [/tracked candidate files/i, /read.only/i]],
  ['review evidence readback', [/read back/i, /report/i, /supporting evidence/i, /before/i, /removing/i, /checkout/i]],
  ['external evidence', [/evidence/i, /outside/i, /archive/i], /no archive/i],
  ['fresh review', [/later review/i, /fresh checkout/i]],
  ['fresh review retention', [/unknown/i, /active evidence/i, /unique bytes/i, /preserved/i]],
  ['untracked retention', [/untracked files/i, /worktree/i, /disposable/i, /prov|establish/i], /never|cannot/i],
  ['terminal evidence retention', [/T3 terminal state alone/i, /discarding evidence/i, /authoriz/i], /does not|cannot|not/i],
  ['acceptance distinct from start', [/input acceptance/i, /started state/i, /effective settings/i, /completed work/i, /distinct evidence/i]],
  ['silence exit', [/silence/i, /contact loss/i, /idle state/i, /prov\w*/i, /exit/i], /never/i],
  ['resume ownership', [/ordinary resume/i, /same owner/i, /author/i, /attempt/i, /worktree/i, /revisions/i, /pending receipts/i]],
  ['uncertain replacement', [/uncertainty/i, /holds/i, /replacement/i]],
  ['ownership transfer', [/explicit user transfer/i, /recipient acceptance/i, /session/i, /scope/i, /revision/i, /authority/i, /before/i, /ownership/i]],
  ['current owner accountability', [/current owner/i, /accountab\w*/i, /until then/i]],
  ['prior owner stop', [/prior owner/i, /stops/i, /after acceptance/i]],
  ['transfer receipt boundary', [/input acceptance/i, /turn start alone/i, /transfer receipt/i], /no transfer receipt|cannot be a transfer receipt/i],
  ['runtime identity mismatch', [/T3/, /threadId\/runId/, /mismatch/i, /stop consuming/i, /reconcile/i, /driver identity/i, /native state/i]],
  ['identity forgery', [/forg\w*/i, /sender/i, /borrow\w*/i, /identity/i, /bypass/i, /mismatch/i], /never/i],
  ['user takeover retention', [/driver/i, /retain/i, /user.taken.over T3 thread/i]],
  ['user takeover cleanup', [/cleanup commands/i, /t3_thread_organize/, /settle/i, /archive/i], /never send/i],
  ['T3 settle evidence', [/require/i, /T3 terminal run evidence/i, /before/i, /t3_thread_organize/, /settle/i, /archive/i]],
  ['T3 metadata boundary', [/metadata actions/i, /worktree removal/i], /not/i],
  ['cleanup preflight', [/worktreeCleanup/, /off/, /every Axstack project/i]],
  ['cleanup readback', [/preflight/i, /t3_project_read/, /where exposed/i]],
  ['cleanup limitation', [/otherwise/i, /record a limitation/i, /documented/i, /installation setup step/i]],
  ['cleanup evidence priority', [/automatic worktree deletion/i, /evidence readback/i, /salvage/i], /cannot replace|no substitute for/i],
  ['run record', [/run record/i, /driver threadId/, /projectId/, /host/i, /T3 version/, /installed Axstack SHA/, /capabilities JSON path/, /scheduledTaskIds/, /watch/i, /manager schedule/i]],
  ['dispatch target record', [/per dispatch/i, /record/i, /key/i, /mechanism/i, /requested target/i, /read.back/i]],
  ['dispatch identity record', [/taskId\/childThreadId\/childRunId/, /threadId\/runId\/worktree\/branch\/base SHA/]],
  ['dispatch revision record', [/checkout path/i, /candidate/i, /base SHAs/i]],
  ['dispatch evidence record', [/evidence folder/i, /scope\/authority/i, /owner/i, /pending receipts/i, /hold/i, /Next/]],
  ['native runtime boundary', [/boundary/i, /Axstack daemon/i, /DB/, /lock/i, /scheduler/i], /no Axstack daemon/i],
  ['publication authority', [/private evidence/i, /requires/i, /explicit publication authority/i, /before sharing/i]],
  ['receipt authority', [/receipts/i, /merge/i, /release/i, /publication/i, /model.substitution/i, /host.mutation/i, /expanded scope authority/i], /no merge/i],
  ['human merge authority', [/human/i, /merges/i, /by default/i]],
];

// Separate editorial holdout: passive voice, reordered operands, and synonyms.
// These sentences are fixtures, not pattern templates or per-rule inversions.
const holdouts = [
  'The orchestrator_capabilities JSON is saved by the driver, a T3 thread, which follows the schema.',
  'Without a substitute runtime, the affected operation holds for missing capability.',
  'Source, time and resolved ID accompany the requested settings and stable role IDs in a snapshot of the selected preset from roles.json.',
  'With no re-resolution, the snapshot is preserved on resume.',
  "The user's explicit decision is required for changes.",
  'Bindings are antigravity→antigravity, grok→grok, claude→claudeAgent and codex→codex.',
  'Use options:[{id,value}] and map modeId into runtimeMode:full-access.',
  'As given, the preset model is used.',
  'For each provider, modelClass resolves the newest catalog entry matching claude-<class>-<N>-<N> or gpt-<N>-<class>.',
  'The saved capabilities JSON path is passed to resolve-models.js with --provider.',
  'Resolution holds for a malformed or missing catalog.',
  'Saved capabilities for the provider supply the first model for model:null with no class.',
  'Record the exact ID rather than an unresolved provider default.',
  'With no substitution, hold an unavailable effort, mode, role, model or provider.',
  'An alternative is never selected for rejection, timeout, quota or auth.',
  'Recorded absences are retained for intentional absent seats.',
  'Runtime proof establishes availability.',
  'Option ID reasoningEffort supplies Codex effort.',
  'Option ID effort supplies Claude effort.',
  'Exclude max for Grok using reasoningEffort.',
  'The CLI must satisfy ≥1.0.13.',
  'That its CLI runs cannot be established by Grok advertising alone.',
  'With no OpenCode role enters this migration, OpenCode effort uses variant.',
  'The requested model and provider match the dispatch echo.',
  'Read-back through t3_thread_configuration must verify runtimeMode and options.',
  'Keep effective and requested values in separate records.',
  'Configuration proof is never a worker self-report.',
  'Roles needing effort hold on missing effort read-back.',
  'Never record it as satisfied.',
  'Until tested, effort read-back for other providers stays unverified.',
  'Before siblings launch, the first dispatch of a provider, model and effort reaches a completed or running run.',
  'Siblings for that configuration are blocked by rejection.',
  'Eligible configurations include unrelated configurations.',
  'In the driver worktree, advisers, diligence and research use async delegate_task with title = dispatch key.',
  'Untracked and tracked files remain untouched.',
  'The delegate writes only <run>/evidence/<key>/.',
  'UI verifier, execution investigators, debug investigators and reviewers use async delegate_task with title = dispatch key.',
  'Use git worktree add --detach for a disposable detached checkout pinned to candidate SHA and pinned base.',
  'Into it the brief requires cd.',
  'Only disposable probes write there, and outputs go to <run>/evidence/<key>/.',
  'Until the PR merges or closes, author and code-arena retain their own worktree, launched by t3_thread_launch with startFromOrigin:false and type:worktree.',
  'The Owner is the Driver thread in the Driver worktree.',
  'Tracked files are never edited.',
  'No worker launch applies.',
  'One writer per candidate is enforced by the driver as sole run-record writer.',
  "The driver never writes tracked files or repairs an author's source.",
  'Repairs go back to the same author.',
  'Ownership never transfers because a session is missing or idle.',
  'In any preset, the current driver has no role entry.',
  'Before launch, record dispatch key <run>:<role>:<task>:a<n> as the exact whole T3 title.',
  'Identity is not established by substring matches.',
  'Use axstack/<run>/<role>/<task>-a<n> as the branch.',
  'Replace [^a-z0-9-] with - and lowercase each segment.',
  'Record both while retaining the dispatch key in its original form.',
  'An identity substitute is never normalization.',
  'baseRef must never be a branch name.',
  'It is always a commit SHA.',
  'Before dispatch, pin the candidate and base.',
  'Workers provide exactly one final marker, AXSTACK-QUESTION key= q=, AXSTACK-FAILED key= head= report=, or AXSTACK-DONE key= head= report=.',
  'Absolute private evidence paths are used in reports.',
  'The pinned candidate SHA is the report-only head.',
  'Through t3_thread_send, launched writers send the marker to the recorded driver thread.',
  'In their final result, delegated children leave the receipt.',
  'Before any t3_thread_read for that delegated task, the driver must persist task_status in private evidence.',
  'Before expanding or consuming the result, save the whole response.',
  'Terminal completed with AXSTACK-DONE, hasPendingChildRuns:false and result_available is required for delegated completion.',
  'Even if completed, a question remains incomplete.',
  'Launched writer completion requires red/green logs, clean tree, non-empty diff and terminal t3_thread_wait.',
  'Only progress is proved by a receipt message alone.',
  'The candidate SHA and current attempt key govern completion.',
  'A newer attempt is never completed by an older attempt.',
  'Stale or duplicate receipts are kept as evidence, deduplicated by runtime identity.',
  'Before acknowledgment, process the whole delivery and advance only after checking artifacts, scope and sender.',
  'Preserved evidence and an incomplete outcome apply to AXSTACK-FAILED, preparing thread error, failed or interrupted run or task_status failed.',
  'Successful completion is never established by silence.',
  'After each delegated completion, the driver compares git status --porcelain including untracked entries and HEAD to pre-dispatch values, which stay unchanged.',
  'Before advancing work, any change is a hold.',
  'For a lost launch response combine git worktree list and fully paginated t3_thread_list titleContains=<key>, filtered by exact whole-title equality.',
  'Through recovery keep the reserved branch.',
  'Proof of absence is prevented by a branch or worktree without a reconciled thread.',
  'In recovery, adopt one exact match when branch and worktree agree.',
  'With the same reserved key and branch, relaunch once on proven absence.',
  'Hold on incomplete inventory, second uncertain response, conflicts or several matches.',
  'Silence never justifies launching a duplicate writer.',
  'Post-launch, the driver calls t3_thread_wait timeoutMs:120000 and classifies failed as launch failure.',
  'Started is established on timed-out when t3_thread_read shows worktreePath and activeRunId.',
  'Still preparing is a hold, to re-read at the next wake.',
  'The attempt is retained in unresolved state.',
  'For AXSTACK-QUESTION, answer once via t3_thread_send to childThreadId, recording resumed runId then t3_thread_wait timeoutMs:600000 re-armed by run watch.',
  'Persist status and accept only latestTerminal* with terminal success and matching receipt key/SHA, newer than the question run by recorded ordering, not lexical ID order.',
  'Stable is the original summary.',
  'No notification is assumed.',
  'A repair uses t3_thread_send mode:queue in the same worktree, same attempt and same author.',
  'The new candidate revision is pinned.',
  'Terminal failure permits replacement using a<n+1>, a new title and new branch.',
  "Until salvage, the failed attempt's branch is kept.",
  'Replacement holds when there is unknown liveness.',
  'Before another writer, reconcile the old writer.',
  'With an unsettled launched thread, the turn can end only with schedule_task bindToCurrentThread:true everyMs:600000 armed and ID recorded.',
  'Each wake must reconcile all unsettled runs, including a writer that died silently.',
  'Incomplete work is held when failed runs occur.',
  'When nothing is unsettled, delete_scheduled_task and read back absence with list_scheduled_tasks.',
  'The hold and recorded ID are retained on an uncertain delete.',
  'In every worker brief, include the Safe-deletion rule.',
  'In the completion receipt and brief, identify the private <run>/evidence/<key>/ folder.',
  'Before cleanup or use, TMPDIR is an owned 0700 directory, real path inside recorded run evidence, no symlink and matching owner.',
  'For worktree-local paths, apply equivalent guards.',
  'Preserved uncertain paths await reconciliation.',
  'With no parent-root deletion and no glob, deletion uses a literal absolute path or ${VAR:?} for an exact validated owned path in the worktree, TMPDIR or evidence.',
  'No glob and no parent-root deletion are permitted.',
  'No parent-root deletion and no glob are allowed.',
  'Never wipe a general cache.',
  'Evidence is not incidental caches.',
  'The dispatching owner must re-verify started after confirming the brief question once and restating existing authority.',
  'A second ask holds.',
  'Trust or permission prompts are never answered.',
  'Brief confirmation adds no authority and does not answer a harness or tool dialog.',
  'A provider safety refusal or permission prompt is an incomplete outcome held for resolution.',
  'Never retry or bypass through another model.',
  'Model prompts, authentication, hook review and trust all hold.',
  'Before authorized recovery, inspect native state and preserve the attempt.',
  'Each reviewer receives a private evidence folder and separate checkout with no first-pass cross-read.',
  'Read-only are the tracked candidate files.',
  'Before removing that checkout, read back supporting evidence and report.',
  'No archive is needed for evidence outside it.',
  'A fresh checkout is used for later review.',
  'Preserved unique bytes include unknown or active evidence.',
  'A worktree is never proven disposable by its untracked files.',
  'Discarding evidence is not authorized by T3 terminal state alone.',
  'Distinct evidence includes completed work, effective settings, started state and input acceptance.',
  'Exit is never proved by idle state, contact loss or silence.',
  'Ordinary resume retains pending receipts and revisions with the same owner, author, attempt and worktree.',
  'Replacement holds on uncertainty.',
  'Before ownership changes, explicit user transfer validates recipient acceptance against authority, revision, scope and session.',
  'Until then, accountability remains with the current owner.',
  'After acceptance, the prior owner stops.',
  'Turn start alone or input acceptance cannot be a transfer receipt.',
  'With a T3 threadId/runId mismatch, stop consuming and reconcile the driver identity with native state.',
  'Never bypass the mismatch by borrowing an identity or forging a sender.',
  'A user-taken-over T3 thread is retained by the driver.',
  'Never send cleanup commands to it, including t3_thread_organize settle or archive.',
  'Before t3_thread_organize settle or archive, require T3 terminal run evidence.',
  'Worktree removal is not performed by these metadata actions.',
  'For every Axstack project worktreeCleanup is off.',
  'Where exposed, preflight uses t3_project_read.',
  'Otherwise, record a limitation pointing to the documented installation setup step.',
  'Automatic worktree deletion cannot replace salvage and evidence readback.',
  'Host, driver threadId, projectId, T3 version, installed Axstack SHA, capabilities JSON path and scheduledTaskIds for each watch and manager schedule belong in the run record.',
  'Per dispatch, requested target, read-back, mechanism and key appear in the record.',
  'Use taskId/childThreadId/childRunId or threadId/runId/worktree/branch/base SHA.',
  'Base SHAs and candidate accompany the checkout path.',
  'Next and hold join pending receipts, owner, scope/authority and evidence folder.',
  'The boundary has no Axstack daemon, DB, lock or scheduler.',
  'Before sharing, private evidence requires explicit publication authority.',
  'Receipts grant no merge, release, publication, model-substitution, host-mutation or expanded scope authority.',
  'By default the human merges.',
];

// Independently written second holdout set, keyed by the instruction name.
const independentHoldouts = {
  "capabilities": "Saving orchestrator_capabilities JSON is the driver's responsibility as a T3 thread following the tool schema.",
  "missing capability": "Hold the affected operation without a substitute runtime if there is a missing capability.",
  "role snapshot": "From roles.json, a snapshot must capture the preset, stable role IDs, requested settings, resolved ID, source and time.",
  "snapshot resume": "The snapshot is retained during resume with no re-resolution.",
  "snapshot change": "An explicit decision by the user is required for any changes.",
  "provider mapping": "Provider bindings assign claude\u2192claudeAgent and antigravity\u2192antigravity alongside codex\u2192codex and grok\u2192grok.",
  "mode and options": "The mapping of modeId yields runtimeMode:full-access, with effort supplied in options:[{id,value}].",
  "pinned model": "Use the preset model as given in the installed snapshot.",
  "class resolution": "Resolution of modelClass selects the newest ID for its provider, matching gpt-<N>-<class> or claude-<class>-<N>-<N>.",
  "resolution catalog": "Pass the saved capabilities JSON path into resolve-models.js --provider.",
  "catalog hold": "Resolution is held when the catalog is missing or malformed.",
  "null model": "For model:null and no class, saved capabilities supply the provider's first model.",
  "null ID receipt": "The exact ID must be recorded in place of an unresolved provider default.",
  "availability hold": "With no substitution, an unavailable provider, model, role, mode or effort is held.",
  "no alternative on failure": "Auth, quota, timeout and rejection never select an alternative.",
  "absent seats": "Intentional absent seats continue as recorded absences on resume.",
  "runtime availability": "Establish availability with runtime proof.",
  "codex effort": "For Codex, effort is supplied through the reasoningEffort option ID.",
  "claude effort": "Claude uses the effort option ID for effort selection.",
  "grok effort": "Grok selects reasoningEffort while excluding max.",
  "Grok CLI floor": "CLI operation requires a version \u22651.0.13.",
  "Grok readiness proof": "Advertising Grok alone does not establish that its CLI runs.",
  "opencode effort": "The variant option sets OpenCode effort, with no OpenCode role enters this migration.",
  "binding echo": "A dispatch echo is required to match both requested model and provider.",
  "binding readback": "Verification of options and runtimeMode requires read-back via t3_thread_configuration.",
  "separate binding evidence": "Effective and requested values are kept in separate records.",
  "worker proof": "A worker self-report never constitutes configuration proof.",
  "missing effort readback": "Roles requiring effort are held when there is missing effort read-back.",
  "effort satisfaction": "It must never be recorded as satisfied.",
  "other effort limitation": "Other providers' effort read-back stays unverified until exercised.",
  "first configuration canary": "The first dispatch per provider, model and effort must reach a running or completed run before siblings launch.",
  "canary rejection": "Siblings of that configuration are blocked once it is rejected.",
  "unrelated configurations": "Unrelated configurations continue to be eligible.",
  "read-only delegates": "Advisers, research and diligence are dispatched with async delegate_task in the driver worktree, title = dispatch key.",
  "delegate untouched": "Tracked files remain untouched alongside untracked files.",
  "delegate evidence": "The task writes only into <run>/evidence/<key>/.",
  "probe delegates": "Async delegate_task handles reviewers, debug investigators, execution investigators and UI verifier, title = dispatch key.",
  "probe checkout": "A disposable detached checkout of candidate SHA and pinned base is created via git worktree add --detach.",
  "probe cd": "The brief requires the task to cd into it.",
  "probe outputs": "Outputs from disposable probes are saved to <run>/evidence/<key>/.",
  "writer launch": "Author and code-arena writers launched with t3_thread_launch type:worktree startFromOrigin:false retain their own worktree until the PR merges or closes.",
  "owner row": "The Owner runs as the Driver thread inside the Driver worktree.",
  "owner source exclusion": "Tracked files must never be written by the owner.",
  "owner worker exclusion": "The owner has no worker launch.",
  "driver ownership": "The driver enforces one writer per candidate and must be the sole run-record writer.",
  "driver source exclusion": "The driver never writes tracked files or repairs the author's source.",
  "repair ownership": "Each repair goes back to the same author.",
  "idle ownership": "Missing or idle sessions confer no ownership transfer.",
  "driver preset exclusion": "No preset gives the current driver a role row.",
  "key and title": "Record dispatch key <run>:<role>:<task>:a<n> for the exact whole T3 title before launch.",
  "substring identity": "Substring matches do not establish identity.",
  "branch naming": "The required branch spelling is axstack/<run>/<role>/<task>-a<n>.",
  "branch encoding": "Replace [^a-z0-9-] with - after lowercasing each segment.",
  "dispatch original": "The dispatch key keeps its original form, and both must be recorded.",
  "normalization identity": "Normalization never serves as an identity substitute.",
  "SHA baseRef": "A branch name must never be used as baseRef.",
  "baseRef commit": "Always use a commit SHA.",
  "pinned dispatch revisions": "Pin both the base and candidate before dispatching.",
  "receipt protocol": "Workers finish with exactly one final marker chosen from AXSTACK-DONE key= head= report=, AXSTACK-FAILED key= head= report= and AXSTACK-QUESTION key= q=.",
  "report identity": "Reports must identify absolute private evidence paths.",
  "report-only head": "Use the pinned candidate SHA as the report-only head.",
  "writer delivery": "The marker is delivered by launched writers to the recorded driver thread using t3_thread_send.",
  "delegate delivery": "The final result from delegated children carries the marker.",
  "status persistence": "The driver persists task_status in private evidence before any t3_thread_read for that delegated task.",
  "whole status": "Save the whole response before consuming or expanding its result.",
  "delegate completion": "Delegated completion requires terminal completed, result_available, hasPendingChildRuns:false and final AXSTACK-DONE.",
  "question incomplete": "A question remains incomplete despite completed native status.",
  "writer completion": "Launched writer completion requires terminal t3_thread_wait before candidate checks for non-empty diff, clean tree and red/green logs.",
  "message progress": "Only progress is established by a receipt message alone.",
  "current completion": "Completion is tied to the candidate SHA together with the current attempt key.",
  "stale completion": "An older attempt never completes a newer attempt.",
  "stale receipt evidence": "Duplicate receipts and stale results remain evidence deduplicated by runtime identity.",
  "delivery validation": "Process the whole delivery before acknowledgment and advance only after checking sender, scope and artifacts.",
  "failure classification": "An incomplete outcome with preserved evidence is required on task_status failed, a run failed or interrupted, preparing thread error or AXSTACK-FAILED.",
  "silence completion": "Successful completion is not established by silence.",
  "delegated isolation": "After each delegated completion, the driver checks HEAD and git status --porcelain against pre-dispatch values, unchanged including untracked entries.",
  "isolation hold": "Any change is a hold before advancing.",
  "launch recovery inventory": "A lost launch response requires fully paginated t3_thread_list titleContains=<key> with exact whole-title equality plus git worktree list.",
  "reserved branch": "The reserved branch is kept throughout recovery.",
  "unreconciled worktree": "Proof of absence is prevented by a worktree or branch without a reconciled thread.",
  "launch recovery outcomes": "Recovery must adopt one exact match only after recorded worktree and branch agree.",
  "relaunch absence": "On proven absence, relaunch once using the same reserved key and branch.",
  "recovery hold": "Hold for several matches, conflicts, a second uncertain response or incomplete inventory.",
  "silence duplicate": "A duplicate writer is never launched on silence.",
  "post-launch wait": "Post-launch, t3_thread_wait timeoutMs:120000 is called by the driver, with failed classified as launch failure.",
  "timed-out started": "A timed-out wait counts as started if t3_thread_read shows activeRunId and worktreePath.",
  "preparing hold": "Still preparing is a hold requiring re-read at the next wake.",
  "unresolved launch": "An unresolved state retains the attempt.",
  "question resume": "For AXSTACK-QUESTION, answer once with t3_thread_send to childThreadId, record resumed runId, then t3_thread_wait timeoutMs:600000 re-armed by run watch.",
  "resumed result": "Persist status before accepting only latestTerminal* newer than the question run, terminal success and matching receipt key/SHA, not lexical ID order.",
  "question summary": "The original summary remains stable.",
  "question notification": "There is no notification assumed for the resumed result.",
  "same writer repair": "Repair is sent to the same author in the same attempt and worktree using t3_thread_send mode:queue.",
  "repair revision": "Pinning of the new candidate revision is required.",
  "replacement attempt": "Replacement uses a<n+1> with a new branch and title after terminal failure.",
  "failed branch salvage": "The failed attempt's branch must be kept until salvage.",
  "unknown writer liveness": "Replacement is held while liveness is unknown.",
  "replacement reconcile": "Reconcile the old writer before admitting another.",
  "idle writer watch": "For an unsettled launched thread, the turn must end only with schedule_task bindToCurrentThread:true everyMs:600000 armed and its ID recorded.",
  "watch reconcile": "Reconcile all unsettled runs at each wake, including a writer that died without sending.",
  "watch failure": "Incomplete work is held for failed runs.",
  "watch deletion": "Delete_scheduled_task must run once nothing remains unsettled, using list_scheduled_tasks to read back absence.",
  "uncertain watch deletion": "An uncertain delete retains the recorded ID and hold.",
  "safe deletion in briefs": "Every worker brief must include the safe-deletion rule.",
  "named private evidence": "Identify the private <run>/evidence/<key>/ folder in the brief and completion receipt.",
  "temporary evidence guard": "Commands must scope TMPDIR to an owned 0700 folder, real path inside recorded run evidence with no symlink and matching owner, before use or cleanup.",
  "worktree path guards": "Worktree-local paths require equivalent guards.",
  "uncertain path retention": "Uncertain paths must be preserved pending reconciliation.",
  "safe deletion": "Deletion uses an exact validated owned path inside evidence, TMPDIR or worktree, literal absolute path or ${VAR:?}, with no glob and no parent-root deletion.",
  "glob deletion": "No parent-root deletion and no glob are accepted.",
  "parent deletion": "No glob and no parent-root deletion are permitted for cleanup.",
  "cache deletion": "A general cache must never be wiped.",
  "cache evidence": "Incidental caches do not count as evidence.",
  "brief confirmation": "The dispatching owner confirms the brief question once with existing authority before re-verifying started state.",
  "second brief hold": "Asking a second time holds.",
  "prompt refusal": "Trust and permission prompts must never be answered.",
  "confirmation authority": "Brief confirmation conveys no authority and does not answer any harness or tool dialog.",
  "prompt refusal hold": "A permission prompt or provider safety refusal results in a held, incomplete outcome.",
  "refusal bypass": "Never bypass the hold or retry through another model.",
  "additional prompt holds": "Authentication, model prompts, trust and hook review are held.",
  "prompt recovery evidence": "Preserve the attempt and inspect native state before authorized recovery.",
  "review evidence isolation": "Each reviewer is allocated a separate checkout and private evidence folder with no first-pass cross-read.",
  "review tracked files": "Tracked candidate files must stay read-only.",
  "review evidence readback": "Read back the report and supporting evidence before removing that checkout.",
  "external evidence": "Outside evidence needs no archive.",
  "fresh review": "Later review requires a fresh checkout.",
  "fresh review retention": "Active evidence, unknown material and unique bytes must be preserved.",
  "untracked retention": "Untracked files cannot prove a worktree disposable.",
  "terminal evidence retention": "T3 terminal state alone does not authorize discarding evidence.",
  "acceptance distinct from start": "Input acceptance, started state, effective settings and completed work constitute distinct evidence.",
  "silence exit": "Silence, idle state and contact loss never establish exit.",
  "resume ownership": "Ordinary resume keeps the same owner, author, attempt and worktree with revisions and pending receipts.",
  "uncertain replacement": "Uncertainty means replacement is held.",
  "ownership transfer": "Explicit user transfer must validate recipient acceptance for session, scope, revision and authority before changing ownership.",
  "current owner accountability": "The current owner stays accountable until then.",
  "prior owner stop": "The prior owner stops after acceptance.",
  "transfer receipt boundary": "Input acceptance and turn start alone are no transfer receipt.",
  "runtime identity mismatch": "A T3 threadId/runId mismatch requires the driver to stop consuming and reconcile driver identity with native state.",
  "identity forgery": "Never forge a sender or borrow an identity to bypass the mismatch.",
  "user takeover retention": "Retention of a user-taken-over T3 thread is required of the driver.",
  "user takeover cleanup": "Never send cleanup commands including t3_thread_organize settle or archive to a user-taken-over thread.",
  "T3 settle evidence": "Require T3 terminal run evidence before t3_thread_organize settle or archive.",
  "T3 metadata boundary": "These metadata actions are not worktree removal.",
  "cleanup preflight": "Every Axstack project sets worktreeCleanup to off.",
  "cleanup readback": "Where exposed, t3_project_read supplies the preflight check.",
  "cleanup limitation": "Otherwise a limitation must be recorded against the documented installation setup step.",
  "cleanup evidence priority": "Automatic worktree deletion cannot replace evidence readback or salvage.",
  "run record": "The run record contains driver threadId, projectId, host, T3 version, installed Axstack SHA, capabilities JSON path and scheduledTaskIds for each watch and manager schedule.",
  "dispatch target record": "The record per dispatch lists key, mechanism, requested target and read-back.",
  "dispatch identity record": "Dispatch identity is taskId/childThreadId/childRunId or threadId/runId/worktree/branch/base SHA.",
  "dispatch revision record": "The checkout path is associated with candidate and base SHAs.",
  "dispatch evidence record": "Evidence folder, scope/authority, owner, pending receipts, hold and Next are recorded.",
  "native runtime boundary": "No Axstack daemon, DB, lock or scheduler belongs in the boundary.",
  "publication authority": "Explicit publication authority is required for private evidence before sharing.",
  "receipt authority": "There is no merge, release, publication, model-substitution, host-mutation or expanded scope authority in receipts.",
  "human merge authority": "Merging is done by the human by default.",
};

// Swap operands rather than just negating the temporal token. Fronted clauses
// have a separate shape so "Before B, A" receives the same sensitivity check.
function clauseSwaps(text) {
  text = text.replace(/[.;]\s*$/, '');
  const fronted = text.match(/^(before|after|until|once)\s+(.+?),\s*(.+)$/i);
  if (fronted) return [`${fronted[1]} ${fronted[3]}, ${fronted[2]}`];
  const infix = text.match(/^(.+?)\s+\b(before|after|until|once|then)\b\s+(.+)$/i);
  return infix ? [`${infix[3]} ${infix[2]} ${infix[1]}`] : [];
}
const orderingRules = new Set([
  'other effort limitation', 'first configuration canary', 'writer launch',
  'key and title', 'pinned dispatch revisions', 'status persistence', 'whole status',
  'writer completion', 'delivery validation', 'delegated isolation', 'isolation hold',
  'launch recovery outcomes', 'question resume', 'resumed result', 'replacement attempt',
  'failed branch salvage', 'replacement reconcile', 'watch deletion',
  'temporary evidence guard', 'brief confirmation', 'prompt recovery evidence',
  'review evidence readback', 'ownership transfer', 'current owner accountability',
  'prior owner stop', 'T3 settle evidence', 'publication authority',
]);
const actorRules = new Set([
  'capabilities', 'role snapshot', 'read-only delegates', 'probe delegates',
  'writer launch', 'owner row', 'driver ownership', 'driver source exclusion',
  'repair ownership', 'writer delivery', 'delegate delivery', 'status persistence',
  'delegated isolation', 'launch recovery inventory', 'post-launch wait',
  'question resume', 'same writer repair', 'idle writer watch', 'watch deletion',
  'brief confirmation', 'review evidence isolation', 'ownership transfer',
  'current owner accountability', 'prior owner stop', 'runtime identity mismatch',
  'user takeover retention', 'human merge authority',
]);
const actorSwaps = (text) => [
  ...[['human', 'agent'], ['driver', 'worker'], ['author', 'replacement'],
    ['owner', 'worker'], ['reviewer', 'author'], ['writers', 'reviewers'],
    ['children', 'writers'], ['user', 'agent']].flatMap(([actor, other]) => {
    const pattern = new RegExp(`\\b${actor}\\b`, 'gi');
    return pattern.test(text) ? [text.replace(pattern, `${other} rather than the ${actor}`)] : [];
  }),
  text.replace(/\bto (?:that|the same) author\b/i, 'from that author to a replacement'),
].filter((changed) => changed !== text);
const antonymTransforms = [
  [/\beligible\b/gi, 'ineligible'], [/\bincomplete\b/gi, 'complete'],
  [/\bcompleted\b/gi, 'uncompleted'], [/\brunning\b/gi, 'unrunning'],
  [/\buntouched\b/gi, 'touched'], [/\bread-only\b/gi, 'writable after read-only setup'],
  [/\bpreserved\b/gi, 'unpreserved'], [/\brequired\b/gi, 'unrequired'],
  [/\bstable\b/gi, 'unstable'], [/\bkept\b/gi, 'unkept'],
  [/\bowned\b/gi, 'unowned'], [/\bvalidated\b/gi, 'unvalidated'],
  [/\barmed\b/gi, 'unarmed'], [/\bexact\b/gi, 'inexact'],
  [/\bnewest\b/gi, 'oldest'], [/\bholds?\b/gi, 'releases any hold on'],
  [/\bheld\b/gi, 'released from hold'],
];
const antonyms = (text) => antonymTransforms.map(([pattern, replacement]) => text.replace(pattern, replacement))
  .filter((changed) => changed !== text);

for (const rule of rules) {
  test(`T3 class fixtures: ${rule[0]}`, () => {
    const text = independentHoldouts[rule[0]];
    if (orderingRules.has(rule[0])) {
      expect(clauseSwaps(text).length, rule[0]).toBeGreaterThan(0);
      for (const changed of clauseSwaps(text)) expect(accepts(changed, rule), changed).toBe(false);
    }
    if (actorRules.has(rule[0])) {
      expect(actorSwaps(text).length, rule[0]).toBeGreaterThan(0);
      for (const changed of actorSwaps(text)) expect(accepts(changed, rule), changed).toBe(false);
    }
    for (const changed of antonyms(text)) expect(accepts(changed, rule), changed).toBe(false);
  });
}

test('prohibits is independent of prior calls with a global prohibition', () => {
  const prohibition = /no glob|no parent-root deletion/gi;
  expect(prohibits('No glob appears here.', prohibition, /missing concept/)).toBe(false);
  expect(prohibits('No glob.', prohibition, /no glob/i)).toBe(true);
  expect(prohibits('No glob.', prohibition, /no glob/i)).toBe(true);
});

// The same transformations apply to every rule; none are authored per rule.
const transformations = [
  [/\bmust\b/gi, 'must not'], [/\bshall\b/gi, 'shall not'],
  [/\brequires?\b/gi, 'does not require'], [/\brequired\b/gi, 'not required'],
  [/\bnever\b/gi, 'always'], [/\balways\b/gi, 'never'],
  [/\bno\b/gi, 'some'], [/\bnot\b/gi, 'indeed'], [/\bcannot\b/gi, 'can'],
  [/\bwithout\b/gi, 'with'], [/\bbefore\b/gi, 'after'],
  [/\bis a hold\b/gi, 'is not a hold'], [/\b(?:holds?|held)\b/gi, 'proceeds'],
  [/commit SHA|branch name/gi, (word) => /commit/i.test(word) ? 'branch name' : 'commit SHA'],
  [/:(?:false|true)\b/g, (word) => word === ':false' ? ':true' : ':false'],
  [/\bexclude\b/gi, 'include'],
];
const inversions = (text) => [...transformations.map(([pattern, replacement]) => text.replace(pattern, replacement)),
  `Do not follow this instruction: ${text}`].filter((changed) => changed !== text);

expect(holdouts.length).toBe(rules.length);
expect(Object.keys(independentHoldouts).sort()).toEqual(rules.map(([name]) => name).sort());
for (const [index, rule] of rules.entries()) {
  test(`T3 sentence: ${rule[0]} rejects removal/inversion and accepts holdout`, () => {
    const source = sentences(runtime());
    const matching = source.filter((sentence) => accepts(sentence, rule));
    expect(matching.length, `missing rule: ${rule[0]}`).toBeGreaterThan(0);
    expect(source.filter((sentence) => !matching.includes(sentence)).some((sentence) => accepts(sentence, rule))).toBe(false);
    expect(accepts(holdouts[index], rule), `holdout: ${holdouts[index]}`).toBe(true);
    expect(accepts(independentHoldouts[rule[0]], rule), independentHoldouts[rule[0]]).toBe(true);
    for (const sentence of [...matching, holdouts[index], independentHoldouts[rule[0]]]) {
      for (const changed of inversions(sentence)) {
        expect(accepts(changed, rule), `${rule[0]}: ${changed}`).toBe(false);
      }
    }
  });
}

// Each scenario names the sentence checks that must remain in the reference.
// Action concepts are order-free and are checked in the fixture and reference.
const recovery = {
  'lost-launch-response': {
    'key and title': ['key and title'],
    'launch recovery inventory': ['launch recovery inventory', 'reserved branch', 'unreconciled worktree'],
    'launch recovery outcomes': ['launch recovery outcomes', 'relaunch absence', 'recovery hold', 'silence duplicate'],
  },
  'silent-provisioning-failure': {
    'SHA baseRef': ['SHA baseRef', 'baseRef commit'],
    'post-launch wait': ['post-launch wait', 'timed-out started', 'preparing hold'],
    'failure classification': ['failure classification'],
  },
  'writer-death-after-idle': {
    'idle writer watch': ['idle writer watch', 'watch reconcile', 'watch failure'],
    'failure classification': ['failure classification'],
    'replacement attempt': ['replacement attempt', 'failed branch salvage', 'unknown writer liveness', 'replacement reconcile'],
  },
  'stale-completion': {
    'stale completion': ['current completion', 'stale completion', 'stale receipt evidence'],
    'status persistence': ['status persistence'],
    'writer completion': ['writer completion'],
  },
  'child-question-resume': {
    'delegate completion': ['delegate completion', 'question incomplete'],
    'question resume': ['question resume', 'resumed result', 'question notification'],
    'status persistence': ['status persistence'],
  },
};
const actions = {
  'lost-launch-response': [
    ['launch recovery outcomes', [/adopt/i, /one exact match/i]],
    ['reserved branch', [/keep/i, /reserved branch/i]],
    ['relaunch absence', [/relaunch once/i, /proven absence/i]],
    ['recovery hold', [/matches/i, /incomplete inventory/i, /hold/i]],
  ],
  'silent-provisioning-failure': [
    ['post-launch wait', [/launch failure/i]],
    ['timed-out started', [/activeRunId/, /worktreePath/, /started/i]],
    ['preparing hold', [/still preparing/i, /hold/i, /next wake/i]],
  ],
  'writer-death-after-idle': [
    ['watch failure', [/failed run/i, /hold/i, /incomplete/i]],
    ['replacement attempt', [/terminal failure/i, /a<n\+1>/]],
    ['failed branch salvage', [/failed/i, /branch/i, /salvage/i]],
  ],
  'stale-completion': [
    ['stale receipt evidence', [/receipt/i, /evidence/i]],
    ['status persistence', [/persist/i, /task_status/, /before/i, /t3_thread_read|thread reads/i]],
    ['writer completion', [/require/i, /terminal/i]],
    ['current completion', [/current attempt/i, /SHA/]],
  ],
  'child-question-resume': [
    ['question resume', [/answer once/i, /t3_thread_send/, /childThreadId/, /600000/, /watch/i]],
    ['resumed result', [/accept only/i, /latestTerminal/, /newer than/i, /question run/i]],
  ],
};

test('AC2 recovery actions stay bound to sentence contracts', () => {
  const scenarios = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json'));
  expect(scenarios.cases.slice(0, 5).map(({ id }) => id)).toEqual(Object.keys(recovery));
  for (const scenario of scenarios.cases.slice(0, 5)) {
    expect(scenario.input).toBeTruthy();
    expect(scenario.contracts).toEqual(Object.keys(recovery[scenario.id]));
    for (const name of Object.values(recovery[scenario.id]).flat()) {
      const rule = rules.find(([id]) => id === name);
      expect(rule, name).toBeDefined();
      expect(accepts(runtime(), rule), `${scenario.id}: ${name}`).toBe(true);
    }
    for (const [name, concepts] of actions[scenario.id]) {
      expect(concepts.every((concept) => concept.test(scenario.expected.action)), `${scenario.id}: action ${name}`).toBe(true);
      const rule = rules.find(([id]) => id === name);
      const instruction = sentences(runtime()).find((sentence) => accepts(sentence, rule));
      expect(concepts.every((concept) => concept.test(instruction)), name).toBe(true);
      for (const concept of concepts) {
        const removed = scenario.expected.action.replace(new RegExp(concept.source, 'gi'), '');
        expect(concepts.every((check) => check.test(removed)), `${scenario.id}: removed action`).toBe(false);
      }
    }
  }
});
