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
  'reserved branch': /^(?!.*(?:\bonly until\b|\buntil recovery begins\b))[^.;]*(?:(?:\bke(?:ep|pt)[^.;]*reserved branch|\breserved branch[^.;]*ke(?:ep|pt))[^.;]*\bthrough(?:out)?\s+recovery\b|\bthrough recovery\s+keep[^.;]*reserved branch)/i,
};
const invertedState = /\b(?:un(?:completed|running|preserved|required|stable|kept|owned|validated|armed)|in(?:eligible|exact)|oldest|writable)\b|\breleas\w*[^.;]*\bhold\b/i;
const accepts = (text, { name, concepts, prohibition }) => sentences(text).some((sentence) =>
  !invertedState.test(sentence)
  && (!relations[name] || relations[name].test(sentence))
  && (!subjects[name] || subjects[name].test(sentence))
  && (!actorRules.has(name) || !/rather than the (?:human|driver|author|owner|reviewers?|writers|children|user)\b/i.test(sentence))
  && (prohibition ? prohibits(sentence, prohibition, ...concepts) : requires(sentence, ...concepts)));
const definitions = [
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
  ['claude effort', [/\bclaude/i, /\beffort/i, /\b(?:option ID effort|effort option ID)\b/i]],
  ['grok effort', [/\bgrok/i, /\breasoningEffort/, /\bexclud\w* max\b/i]],
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
  ['question incomplete', [/\bquestion/i, /\bincomplete/i, /\bcompleted/i]],
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
  ['launch recovery outcomes', [/\brecovery/i, /\badopt/i, /\bone exact match/i, /\bworktree/i, /\bbranch/i, /\bagree/i]],
  ['relaunch absence', [/\bproven absence/i, /\brelaunch once/i, /\bsame reserved key/i, /\bbranch/i]],
  ['recovery hold', [/\bseveral matches/i, /\bconflicts/i, /\bsecond uncertain response/i, /incomplete inventory/i, /\b(?:holds?|held)\b/i]],
  ['silence duplicate', [/\bduplicate writer/i, /\bsilence/i, /\blaunch|start|justif/i], /\bnever/i],
  ['post-launch wait', [/\bpost.launch/i, /\bdriver/i, /\bt3_thread_wait/, /\btimeoutMs:120000/, /\bfailed/i, /\blaunch failure/i]],
  ['timed-out started', [/\btimed.out/i, /\bt3_thread_read/, /\bactiveRunId/, /\bworktreePath/, /\bstarted/i]],
  ['preparing hold', [/\bstill preparing/i, /is a hold/i, /\bre.read/i, /\bnext wake/i]],
  ['unresolved launch', [/\bunresolved state/i, /\bpreserve|retain/i, /\battempt/i]],
  ['question resume', [/\bAXSTACK-QUESTION/, /\banswer once/i, /\bt3_thread_send/, /\bchildThreadId/, /\bresumed runId/i, /\bt3_thread_wait/, /\btimeoutMs:600000/, /\brun watch/i]],
  ['resumed result', [/\bpersist status/i, /\baccept(?:ing)? only/i, /\blatestTerminal/, /\bnewer than/i, /\bquestion run/i, /\bterminal success/i, /\bmatching receipt key\/SHA/i], /\bnot lexical ID order/i],
  ['question summary', [/\boriginal summary/i, /\bstable/i]],
  ['question notification', [/\bnotification/i], /\bno notification/i],
  ['same writer repair', [/\brepair/i, /\bt3_thread_send/, /\bmode:queue/, /\bsame author/i, /\bsame attempt/i, /\bworktree/i]],
  ['repair revision', [/\bpin/i, /\bnew candidate revision/i]],
  ['replacement attempt', [/\breplacement/i, /\bterminal failure/i, /\ba<n\+1>/, /\bnew branch/i, /\btitle/i]],
  ['failed branch salvage', [/\bfailed attempt/i, /\bbranch/i, /\bkept/i, /\buntil salvage/i]],
  ['unknown writer liveness', [/\bunknown/i, /\bliveness/i, /\b(?:holds?|held)\b/i, /\breplacement/i]],
  ['replacement reconcile', [/\breconcile/i, /\bold writer/i, /\bbefore/i, /\banother/i]],
  ['idle writer watch', [/\bunsettled launched thread/i, /\bturn/i, /\bend only/i, /\bschedule_task/, /\bbindToCurrentThread:true/, /\beveryMs:600000/, /\barmed/i, /\bID recorded/i]],
  ['watch reconcile', [/\beach wake/i, /\breconcile all unsettled runs/i, /\bwriter/i, /\bdied/i, /\bwithout sending|silently/i]],
  ['watch failure', [/\bfailed runs/i, /\b(?:holds?|held)\b/i, /incomplete work/i]],
  ['watch deletion', [/\bnothing/i, /\bunsettled/i, /\bdelete_scheduled_task/, /\blist_scheduled_tasks/, /\bread.back/i, /\babsence/i]],
  ['uncertain watch deletion', [/\buncertain delete/i, /\bpreserve|retain/i, /\b(?:holds?|held)\b/i, /\brecorded ID/i]],
  ['safe deletion in briefs', [/\bput|include/i, /\bsafe.deletion rule/i, /\bevery worker brief/i]],
  ['named private evidence', [/\bname|identify/i, /\bprivate/i, /<run>\/evidence\/<key>\//, /\bbrief/i, /\bcompletion receipt/i]],
  ['temporary evidence guard', [/\bbefore/i, /\buse/i, /\bcleanup/i, /\bTMPDIR/, /0700/, /\bowned/i, /\breal path/i, /inside/i, /\brecorded run evidence/i, /\bowner/i], /\bno symlink/i],
  ['worktree path guards', [/\bequivalent guards/i, /\bworktree.local paths/i]],
  ['uncertain path retention', [/\buncertain paths/i, /\bpreserved/i, /\breconciliation/i]],
  ['safe deletion', [/\bdeletion/i, /\bexact validated owned path/i, /\bevidence/i, /\bTMPDIR/, /\bworktree/i, /\bliteral absolute path/i, /\$\{VAR:\?\}/, /\bno glob/i, /\bno parent.root deletion/i], /\bno glob|no parent.root deletion/gi],
  ['glob deletion', [/\bno glob/i, /\bno parent.root deletion/i], /\bno glob|no parent.root deletion/gi],
  ['parent deletion', [/\bno parent.root deletion/i, /\bno glob/i], /\bno glob|no parent.root deletion/gi],
  ['cache deletion', [/general cache/i], /\bnever (?:wipe a general cache|be wiped)/i],
  ['cache evidence', [/incidental caches/i, /\bevidence/i], /\bnot/i],
  ['brief confirmation', [/\bdispatching owner/i, /\bconfirm/i, /\bbrief question once/i, /\bexisting authority/i, /\bre.verify/i, /\bstarted/i]],
  ['second brief hold', [/\bsecond/i, /\bask/i, /\b(?:holds?|held)\b/i]],
  ['prompt refusal', [/\banswer/i, /\btrust/i, /\bpermission prompts/i], /\bnever/i],
  ['confirmation authority', [/\bbrief confirmation/i, /\bno authority/i, /\bharness/i, /\btool dialog/i, /\bdoes not answer/i], /\bno authority|does not answer/gi],
  ['prompt refusal hold', [/\bpermission prompt/i, /\bprovider safety refusal/i, /\bheld\b/i, /incomplete outcome/i]],
  ['refusal bypass', [/\bbypass/i, /\bretry/i, /\banother model/i], /\bnever/i],
  ['additional prompt holds', [/\btrust/i, /\bhook review/i, /\bauthentication/i, /\bmodel prompts/i, /\b(?:holds?|held)\b/i]],
  ['prompt recovery evidence', [/\bpreserve/i, /\battempt/i, /inspect/i, /\bnative state/i, /\bbefore/i, /\bauthorized recovery/i]],
  ['review evidence isolation', [/\beach reviewer/i, /\bseparate checkout/i, /\bprivate evidence folder/i], /\bno first-pass cross-read/i],
  ['review tracked files', [/\btracked candidate files/i, /\bread.only/i]],
  ['review evidence readback', [/\bread.back/i, /\breport/i, /\bsupporting evidence/i, /\bbefore/i, /\bremoving/i, /\bcheckout/i]],
  ['external evidence', [/\bevidence/i, /\boutside/i, /\barchive/i], /\bno archive/i],
  ['fresh review', [/\blater review/i, /\bfresh checkout/i]],
  ['fresh review retention', [/\bunknown/i, /\bactive evidence/i, /\bunique bytes/i, /\bpreserved/i]],
  ['untracked retention', [/\buntracked files/i, /\bworktree/i, /\bdisposable/i, /\bprov|establish/i], /\bnever|cannot/i],
  ['terminal evidence retention', [/\bT3 terminal state alone/i, /\bdiscarding evidence/i, /\bauthoriz/i], /\bdoes not|cannot|not/i],
  ['acceptance distinct from start', [/input acceptance/i, /\bstarted state/i, /\beffective settings/i, /\bcompleted work/i, /\bdistinct evidence/i]],
  ['silence exit', [/\bsilence/i, /\bcontact loss/i, /idle state/i, /\bprov\w*|establish/i, /\bexit/i], /\bnever/i],
  ['resume ownership', [/\bordinary resume/i, /\bsame owner/i, /\bauthor/i, /\battempt/i, /\bworktree/i, /\brevisions/i, /\bpending receipts/i]],
  ['uncertain replacement', [/\buncertainty/i, /\b(?:holds?|held)\b/i, /\breplacement/i]],
  ['ownership transfer', [/\bexplicit user transfer/i, /\brecipient acceptance/i, /\bsession/i, /\bscope/i, /\brevision/i, /\bauthority/i, /\bbefore/i, /\bownership/i]],
  ['current owner accountability', [/\bcurrent owner/i, /\baccountab\w*/i, /\buntil then/i]],
  ['prior owner stop', [/\bprior owner/i, /\bstops/i, /\bafter acceptance/i]],
  ['transfer receipt boundary', [/input acceptance/i, /\bturn start alone/i, /\btransfer receipt/i], /\bno transfer receipt|cannot be a transfer receipt/i],
  ['runtime identity mismatch', [/\bT3/, /\bthreadId\/runId/, /\bmismatch/i, /\bstop consuming/i, /\breconcile/i, /\bdriver identity/i, /\bnative state/i]],
  ['identity forgery', [/\bforg\w*/i, /\bsender/i, /\bborrow\w*/i, /identity/i, /\bbypass/i, /\bmismatch/i], /\bnever/i],
  ['user takeover retention', [/\bdriver/i, /\bretain|retention/i, /\buser.taken.over T3 thread/i]],
  ['user takeover cleanup', [/\bcleanup commands/i, /\bt3_thread_organize/, /\bsettle/i, /\barchive/i], /\bnever send/i],
  ['T3 settle evidence', [/\brequir/i, /\bT3 terminal run evidence/i, /\bbefore/i, /\bt3_thread_organize/, /\bsettle/i, /\barchive/i]],
  ['T3 metadata boundary', [/\bmetadata actions/i, /\bworktree removal/i], /\bnot/i],
  ['cleanup preflight', [/\bworktreeCleanup/, /\boff/, /\bevery Axstack project/i]],
  ['cleanup readback', [/\bpreflight/i, /\bt3_project_read/, /\bwhere exposed/i]],
  ['cleanup limitation', [/\botherwise/i, /\brecord/i, /\blimitation/i, /\bdocumented/i, /installation setup step/i]],
  ['cleanup evidence priority', [/\bautomatic worktree deletion/i, /\bevidence readback/i, /\bsalvage/i], /\bcannot replace|no substitute for/i],
  ['run record', [/\brun record/i, /\bdriver threadId/, /\bprojectId/, /\bhost/i, /\bT3 version/, /installed Axstack SHA/, /\bcapabilities JSON path/, /\bscheduledTaskIds/, /\bwatch/i, /\bmanager schedule/i]],
  ['dispatch target record', [/\bper dispatch/i, /\brecord/i, /\bkey/i, /\bmechanism/i, /\brequested target/i, /\bread.back/i]],
  ['dispatch identity record', [/\btaskId\/childThreadId\/childRunId/, /\bthreadId\/runId\/worktree\/branch\/base SHA/]],
  ['dispatch revision record', [/\bcheckout path/i, /\bcandidate/i, /\bbase SHAs/i]],
  ['dispatch evidence record', [/\bevidence folder/i, /\bscope\/authority/i, /\bowner/i, /\bpending receipts/i, /\b(?:holds?|held)\b/i, /\bNext/]],
  ['native runtime boundary', [/\bboundary/i, /\bAxstack daemon/i, /\bDB/, /\block/i, /\bscheduler/i], /\bno Axstack daemon/i],
  ['publication authority', [/\bprivate evidence/i, /\brequir/i, /\bexplicit publication authority/i, /\bbefore sharing/i]],
  ['receipt authority', [/\breceipts/i, /\bmerge/i, /\brelease/i, /\bpublication/i, /\bmodel.substitution/i, /\bhost.mutation/i, /\bexpanded scope authority/i], /\bno merge/i],
  ['human merge authority', [/\bhuman/i, /\bmerg/i, /\bby default/i]],
];

// Editorial fixtures are written separately from patterns, keyed by rule name.
// Each row receives both the retained holdout and the independent second voice.
const holdouts = {
  "capabilities": ["The orchestrator_capabilities JSON is saved by the driver, a T3 thread, which follows the schema.",
    "Saving orchestrator_capabilities JSON is the driver's responsibility as a T3 thread following the tool schema."],
  "missing capability": ["Without a substitute runtime, the affected operation holds for missing capability.",
    "Hold the affected operation without a substitute runtime if there is a missing capability."],
  "role snapshot": ["Source, time and resolved ID accompany the requested settings and stable role IDs in a snapshot of the selected preset from roles.json.",
    "The driver, from roles.json, must take a snapshot must capture the preset, stable role IDs, requested settings, resolved ID, source and time."],
  "snapshot resume": ["With no re-resolution, the snapshot is preserved on resume.",
    "The snapshot is retained during resume with no re-resolution."],
  "snapshot change": ["The user's explicit decision is required for changes.",
    "An explicit decision by the user is required for any changes."],
  "provider mapping": ["Bindings are antigravity\u2192antigravity, grok\u2192grok, claude\u2192claudeAgent and codex\u2192codex.",
    "Provider bindings assign claude\u2192claudeAgent and antigravity\u2192antigravity alongside codex\u2192codex and grok\u2192grok."],
  "mode and options": ["Use options:[{id,value}] and map modeId into runtimeMode:full-access.",
    "The mapping of modeId yields runtimeMode:full-access, with effort supplied in options:[{id,value}]."],
  "pinned model": ["As given, the preset model is used.",
    "Use the preset model as given in the installed snapshot."],
  "class resolution": ["For each provider, modelClass resolves the newest catalog entry matching claude-<class>-<N>-<N> or gpt-<N>-<class>.",
    "Resolution of modelClass selects the newest ID for its provider, matching gpt-<N>-<class> or claude-<class>-<N>-<N>."],
  "resolution catalog": ["The saved capabilities JSON path is passed to resolve-models.js with --provider.",
    "Pass the saved capabilities JSON path into resolve-models.js --provider."],
  "catalog hold": ["Resolution holds for a malformed or missing catalog.",
    "Resolution is held when the catalog is missing or malformed."],
  "null model": ["Saved capabilities for the provider supply the first model for model:null with no class.",
    "For model:null and no class, saved capabilities supply the provider's first model."],
  "null ID receipt": ["Record the exact ID rather than an unresolved provider default.",
    "The exact ID must be recorded in place of an unresolved provider default."],
  "availability hold": ["With no substitution, hold an unavailable effort, mode, role, model or provider.",
    "With no substitution, an unavailable provider, model, role, mode or effort is held."],
  "no alternative on failure": ["An alternative is never selected for rejection, timeout, quota or auth.",
    "Auth, quota, timeout and rejection never select an alternative."],
  "absent seats": ["Recorded absences are retained for intentional absent seats.",
    "Intentional absent seats continue as recorded absences on resume."],
  "runtime availability": ["Runtime proof establishes availability.",
    "Establish availability with runtime proof."],
  "codex effort": ["Option ID reasoningEffort supplies Codex effort.",
    "For Codex, effort is supplied through the reasoningEffort option ID."],
  "claude effort": ["Option ID effort supplies Claude effort.",
    "Claude uses the effort option ID for effort selection."],
  "grok effort": ["Exclude max for Grok using reasoningEffort.",
    "Grok selects reasoningEffort while excluding max."],
  "Grok CLI floor": ["The CLI must satisfy \u22651.0.13.",
    "CLI operation requires a version \u22651.0.13."],
  "Grok readiness proof": ["That its CLI runs cannot be established by Grok advertising alone.",
    "Advertising Grok alone does not establish that its CLI runs."],
  "opencode effort": ["With no OpenCode role enters this migration, OpenCode effort uses variant.",
    "The variant option sets OpenCode effort, with no OpenCode role enters this migration."],
  "binding echo": ["The requested model and provider match the dispatch echo.",
    "A dispatch echo is required to match both requested model and provider."],
  "binding readback": ["Read-back through t3_thread_configuration must verify runtimeMode and options.",
    "Verification of options and runtimeMode requires read-back via t3_thread_configuration."],
  "separate binding evidence": ["Keep effective and requested values in separate records.",
    "Effective and requested values are kept in separate records."],
  "worker proof": ["Configuration proof is never a worker self-report.",
    "A worker self-report never constitutes configuration proof."],
  "missing effort readback": ["Roles needing effort hold on missing effort read-back.",
    "Roles requiring effort are held when there is missing effort read-back."],
  "effort satisfaction": ["Never record it as satisfied.",
    "It must never be recorded as satisfied."],
  "other effort limitation": ["Until tested, effort read-back for other providers stays unverified.",
    "Other providers' effort read-back stays unverified until exercised."],
  "first configuration canary": ["Before siblings launch, the first dispatch of a provider, model and effort reaches a completed or running run.",
    "The first dispatch per provider, model and effort must reach a running or completed run before siblings launch."],
  "canary rejection": ["Siblings for that configuration are blocked by rejection.",
    "Siblings of that configuration are blocked once it is rejected."],
  "unrelated configurations": ["Eligible configurations include unrelated configurations.",
    "Unrelated configurations continue to be eligible."],
  "read-only delegates": ["In the driver worktree, advisers, diligence and research use async delegate_task with title = dispatch key.",
    "Advisers, research and diligence are dispatched with async delegate_task in the driver worktree, title = dispatch key."],
  "delegate untouched": ["Untracked and tracked files remain untouched.",
    "Tracked files remain untouched alongside untracked files."],
  "delegate evidence": ["The delegate writes only <run>/evidence/<key>/.",
    "The task writes only into <run>/evidence/<key>/."],
  "probe delegates": ["UI verifier, execution investigators, debug investigators and reviewers use async delegate_task with title = dispatch key.",
    "Async delegate_task handles each reviewer and reviewers, debug investigators, execution investigators and UI verifier, title = dispatch key."],
  "probe checkout": ["Use git worktree add --detach for a disposable detached checkout pinned to candidate SHA and pinned base.",
    "A disposable detached checkout of candidate SHA and pinned base is created via git worktree add --detach."],
  "probe cd": ["Into it the brief requires cd.",
    "The brief requires the task to cd into it."],
  "probe outputs": ["Only disposable probes write there, and outputs go to <run>/evidence/<key>/.",
    "Outputs from disposable probes are saved to <run>/evidence/<key>/."],
  "writer launch": ["Until the PR merges or closes, author and code-arena retain their own worktree, launched by t3_thread_launch with startFromOrigin:false and type:worktree.",
    "Author and code-arena writers launched with t3_thread_launch type:worktree startFromOrigin:false retain their own worktree until the PR merges or closes."],
  "owner row": ["The Owner is the Driver thread in the Driver worktree.",
    "The Owner runs as the Driver thread inside the Driver worktree."],
  "owner source exclusion": ["Tracked files are never edited.",
    "Tracked files must never be written by the owner."],
  "owner worker exclusion": ["No worker launch applies.",
    "The owner has no worker launch."],
  "driver ownership": ["One writer per candidate is enforced by the driver as sole run-record writer.",
    "The driver enforces one writer per candidate and must be the sole run-record writer."],
  "driver source exclusion": ["The driver never writes tracked files or repairs an author's source.",
    "The driver never writes tracked files or repairs the author's source."],
  "repair ownership": ["Repairs go back to the same author.",
    "Each repair goes back to the same author."],
  "idle ownership": ["Ownership never transfers because a session is missing or idle.",
    "Missing or idle sessions confer no ownership transfer."],
  "driver preset exclusion": ["In any preset, the current driver has no role entry.",
    "No preset gives the current driver a role row."],
  "key and title": ["Before launch, record dispatch key <run>:<role>:<task>:a<n> as the exact whole T3 title.",
    "Record dispatch key <run>:<role>:<task>:a<n> for the exact whole T3 title before launch."],
  "substring identity": ["Identity is not established by substring matches.",
    "Substring matches do not establish identity."],
  "branch naming": ["Use axstack/<run>/<role>/<task>-a<n> as the branch.",
    "The required branch spelling is axstack/<run>/<role>/<task>-a<n>."],
  "branch encoding": ["Replace [^a-z0-9-] with - and lowercase each segment.",
    "Replace [^a-z0-9-] with - after lowercasing each segment."],
  "dispatch original": ["Record both while retaining the dispatch key in its original form.",
    "The dispatch key keeps its original form, and both must be recorded."],
  "normalization identity": ["An identity substitute is never normalization.",
    "Normalization never serves as an identity substitute."],
  "SHA baseRef": ["baseRef must never be a branch name.",
    "A branch name must never be used as baseRef."],
  "baseRef commit": ["It is always a commit SHA.",
    "Always use a commit SHA."],
  "pinned dispatch revisions": ["Before dispatch, pin the candidate and base.",
    "Pin both the base and candidate before dispatching."],
  "receipt protocol": ["Workers provide exactly one final marker, AXSTACK-QUESTION key= q=, AXSTACK-FAILED key= head= report=, or AXSTACK-DONE key= head= report=.",
    "Workers finish with exactly one final marker chosen from AXSTACK-DONE key= head= report=, AXSTACK-FAILED key= head= report= and AXSTACK-QUESTION key= q=."],
  "report identity": ["Absolute private evidence paths are used in reports.",
    "Reports must identify absolute private evidence paths."],
  "report-only head": ["The pinned candidate SHA is the report-only head.",
    "Use the pinned candidate SHA as the report-only head."],
  "writer delivery": ["Through t3_thread_send, launched writers send the marker to the recorded driver thread.",
    "The marker is delivered by launched writers to the recorded driver thread using t3_thread_send."],
  "delegate delivery": ["In their final result, delegated children leave the receipt.",
    "The final result from delegated children carries the marker."],
  "status persistence": ["Before any t3_thread_read for that delegated task, the driver must persist task_status in private evidence.",
    "The driver persists task_status in private evidence before any t3_thread_read for that delegated task."],
  "whole status": ["Before expanding or consuming the result, save the whole response.",
    "Save the whole response before consuming or expanding its result."],
  "delegate completion": ["Terminal completed with AXSTACK-DONE, hasPendingChildRuns:false and result_available is required for delegated completion.",
    "Delegated completion requires terminal completed, result_available, hasPendingChildRuns:false and final AXSTACK-DONE."],
  "question incomplete": ["Even if completed, a question remains incomplete.",
    "A question remains incomplete despite completed native status."],
  "writer completion": ["Launched writer completion requires terminal t3_thread_wait before checks for red/green logs, clean tree and non-empty diff.",
    "Launched writer completion requires terminal t3_thread_wait before candidate checks for non-empty diff, clean tree and red/green logs."],
  "message progress": ["Only progress is proved by a receipt message alone.",
    "Only progress is established by a receipt message alone."],
  "current completion": ["The candidate SHA and current attempt key govern completion.",
    "Completion is tied to the candidate SHA together with the current attempt key."],
  "stale completion": ["A newer attempt is never completed by an older attempt.",
    "An older attempt never completes a newer attempt."],
  "stale receipt evidence": ["Stale or duplicate receipts are kept as evidence, deduplicated by runtime identity.",
    "Duplicate receipts and stale results remain evidence deduplicated by runtime identity."],
  "delivery validation": ["Before acknowledgment, process the whole delivery and advance only after checking artifacts, scope and sender.",
    "Process the whole delivery before acknowledgment and advance only after checking sender, scope and artifacts."],
  "failure classification": ["Preserved evidence and an incomplete outcome apply to AXSTACK-FAILED, preparing thread error, failed or interrupted run or task_status failed.",
    "An incomplete outcome with preserved evidence is required on task_status failed, a run failed or interrupted, preparing thread error or AXSTACK-FAILED."],
  "silence completion": ["Successful completion is never established by silence.",
    "Successful completion is not established by silence."],
  "delegated isolation": ["After each delegated completion, the driver compares git status --porcelain including untracked entries and HEAD to pre-dispatch values, which stay unchanged.",
    "After each delegated completion, the driver checks HEAD and git status --porcelain against pre-dispatch values, unchanged including untracked entries."],
  "isolation hold": ["Before advancing work, any change is a hold.",
    "Any change is a hold before advancing."],
  "launch recovery inventory": ["For a lost launch response combine git worktree list and fully paginated t3_thread_list titleContains=<key>, filtered by exact whole-title equality.",
    "The driver handling a lost launch response requires fully paginated t3_thread_list titleContains=<key> with exact whole-title equality plus git worktree list."],
  "reserved branch": ["Through recovery keep the reserved branch.",
    "The reserved branch is kept throughout recovery."],
  "unreconciled worktree": ["Proof of absence is prevented by a branch or worktree without a reconciled thread.",
    "Proof of absence is prevented by a worktree or branch without a reconciled thread."],
  "launch recovery outcomes": ["In recovery, adopt one exact match only after branch and worktree agree.",
    "Recovery must adopt one exact match only after recorded worktree and branch agree."],
  "relaunch absence": ["With the same reserved key and branch, relaunch once on proven absence.",
    "On proven absence, relaunch once using the same reserved key and branch."],
  "recovery hold": ["Hold on incomplete inventory, second uncertain response, conflicts or several matches.",
    "Hold for several matches, conflicts, a second uncertain response or incomplete inventory."],
  "silence duplicate": ["Silence never justifies launching a duplicate writer.",
    "A duplicate writer is never launched on silence."],
  "post-launch wait": ["Post-launch, the driver calls t3_thread_wait timeoutMs:120000 and classifies failed as launch failure.",
    "Post-launch, t3_thread_wait timeoutMs:120000 is called by the driver, with failed classified as launch failure."],
  "timed-out started": ["Started is established on timed-out when t3_thread_read shows worktreePath and activeRunId.",
    "A timed-out wait counts as started if t3_thread_read shows activeRunId and worktreePath."],
  "preparing hold": ["Still preparing is a hold, to re-read at the next wake.",
    "Still preparing is a hold requiring re-read at the next wake."],
  "unresolved launch": ["The attempt is retained in unresolved state.",
    "An unresolved state retains the attempt."],
  "question resume": ["For AXSTACK-QUESTION, answer once via t3_thread_send to childThreadId, recording resumed runId then t3_thread_wait timeoutMs:600000 re-armed by run watch.",
    "For AXSTACK-QUESTION, the driver must answer once with t3_thread_send to childThreadId, record resumed runId, then t3_thread_wait timeoutMs:600000 re-armed by run watch."],
  "resumed result": ["Persist status before accepting only latestTerminal* with terminal success and matching receipt key/SHA, newer than the question run by recorded ordering, not lexical ID order.",
    "Persist status before accepting only latestTerminal* newer than the question run, terminal success and matching receipt key/SHA, not lexical ID order."],
  "question summary": ["Stable is the original summary.",
    "The original summary remains stable."],
  "question notification": ["No notification is assumed.",
    "There is no notification assumed for the resumed result."],
  "same writer repair": ["A repair uses t3_thread_send mode:queue in the same worktree, same attempt and same author.",
    "Repair is sent to the same author in the same attempt and worktree using t3_thread_send mode:queue."],
  "repair revision": ["The new candidate revision is pinned.",
    "Pinning of the new candidate revision is required."],
  "replacement attempt": ["After terminal failure, replacement uses a<n+1>, a new title and new branch.",
    "Replacement uses a<n+1> with a new branch and title after terminal failure."],
  "failed branch salvage": ["Until salvage, the failed attempt's branch is kept.",
    "The failed attempt's branch must be kept until salvage."],
  "unknown writer liveness": ["Replacement holds when there is unknown liveness.",
    "Replacement is held while liveness is unknown."],
  "replacement reconcile": ["Before another writer, reconcile the old writer.",
    "Reconcile the old writer before admitting another."],
  "idle writer watch": ["With an unsettled launched thread, the turn can end only with schedule_task bindToCurrentThread:true everyMs:600000 armed and ID recorded.",
    "For an unsettled launched thread, the driver turn must end only with schedule_task bindToCurrentThread:true everyMs:600000 armed and its ID recorded."],
  "watch reconcile": ["Each wake must reconcile all unsettled runs, including a writer that died silently.",
    "Reconcile all unsettled runs at each wake, including a writer that died without sending."],
  "watch failure": ["Incomplete work is held when failed runs occur.",
    "Incomplete work is held for failed runs."],
  "watch deletion": ["When nothing is unsettled, delete_scheduled_task and read back absence with list_scheduled_tasks.",
    "The driver calls delete_scheduled_task once nothing remains unsettled, using list_scheduled_tasks to read back absence."],
  "uncertain watch deletion": ["The hold and recorded ID are retained on an uncertain delete.",
    "An uncertain delete retains the recorded ID and hold."],
  "safe deletion in briefs": ["In every worker brief, include the Safe-deletion rule.",
    "Every worker brief must include the safe-deletion rule."],
  "named private evidence": ["In the completion receipt and brief, identify the private <run>/evidence/<key>/ folder.",
    "Identify the private <run>/evidence/<key>/ folder in the brief and completion receipt."],
  "temporary evidence guard": ["Before cleanup or use, TMPDIR is an owned 0700 directory, real path inside recorded run evidence, no symlink and matching owner.",
    "Commands must scope TMPDIR to an owned 0700 folder, real path inside recorded run evidence with no symlink and matching owner, before use or cleanup."],
  "worktree path guards": ["For worktree-local paths, apply equivalent guards.",
    "Worktree-local paths require equivalent guards."],
  "uncertain path retention": ["Preserved uncertain paths await reconciliation.",
    "Uncertain paths must be preserved pending reconciliation."],
  "safe deletion": ["With no parent-root deletion and no glob, deletion uses a literal absolute path or ${VAR:?} for an exact validated owned path in the worktree, TMPDIR or evidence.",
    "Deletion uses an exact validated owned path inside evidence, TMPDIR or worktree, literal absolute path or ${VAR:?}, with no glob and no parent-root deletion."],
  "glob deletion": ["No glob and no parent-root deletion are permitted.",
    "No parent-root deletion and no glob are accepted."],
  "parent deletion": ["No parent-root deletion and no glob are allowed.",
    "No glob and no parent-root deletion are permitted for cleanup."],
  "cache deletion": ["Never wipe a general cache.",
    "A general cache must never be wiped."],
  "cache evidence": ["Evidence is not incidental caches.",
    "Incidental caches do not count as evidence."],
  "brief confirmation": ["The dispatching owner must re-verify started after confirming the brief question once and restating existing authority.",
    "The dispatching owner confirms the brief question once with existing authority before re-verifying started state."],
  "second brief hold": ["A second ask holds.",
    "Asking a second time holds."],
  "prompt refusal": ["Trust or permission prompts are never answered.",
    "Trust and permission prompts must never be answered."],
  "confirmation authority": ["Brief confirmation adds no authority and does not answer a harness or tool dialog.",
    "Brief confirmation conveys no authority and does not answer any harness or tool dialog."],
  "prompt refusal hold": ["A provider safety refusal or permission prompt is an incomplete outcome held for resolution.",
    "A permission prompt or provider safety refusal results in a held, incomplete outcome."],
  "refusal bypass": ["Never retry or bypass through another model.",
    "Never bypass or retry through another model."],
  "additional prompt holds": ["Model prompts, authentication, hook review and trust all hold.",
    "Authentication, model prompts, trust and hook review are held."],
  "prompt recovery evidence": ["Before authorized recovery, inspect native state and preserve the attempt.",
    "Preserve the attempt and inspect native state before authorized recovery."],
  "review evidence isolation": ["Each reviewer receives a private evidence folder and separate checkout with no first-pass cross-read.",
    "Each reviewer is allocated a separate checkout and private evidence folder with no first-pass cross-read."],
  "review tracked files": ["Read-only are the tracked candidate files.",
    "Tracked candidate files must stay read-only."],
  "review evidence readback": ["Before removing that checkout, read back supporting evidence and report.",
    "Read back the report and supporting evidence before removing that checkout."],
  "external evidence": ["No archive is needed for evidence outside it.",
    "Outside evidence needs no archive."],
  "fresh review": ["A fresh checkout is used for later review.",
    "Later review requires a fresh checkout."],
  "fresh review retention": ["Preserved unique bytes include unknown or active evidence.",
    "Active evidence, unknown material and unique bytes must be preserved."],
  "untracked retention": ["A worktree is never proven disposable by its untracked files.",
    "Untracked files cannot prove a worktree disposable."],
  "terminal evidence retention": ["Discarding evidence is not authorized by T3 terminal state alone.",
    "T3 terminal state alone does not authorize discarding evidence."],
  "acceptance distinct from start": ["Distinct evidence includes completed work, effective settings, started state and input acceptance.",
    "Input acceptance, started state, effective settings and completed work constitute distinct evidence."],
  "silence exit": ["Exit is never proved by idle state, contact loss or silence.",
    "Silence, idle state and contact loss never establish exit."],
  "resume ownership": ["Ordinary resume retains pending receipts and revisions with the same owner, author, attempt and worktree.",
    "Ordinary resume keeps the same owner, author, attempt and worktree with revisions and pending receipts."],
  "uncertain replacement": ["Replacement holds on uncertainty.",
    "Uncertainty means replacement is held."],
  "ownership transfer": ["Before ownership changes, explicit user transfer validates recipient acceptance against authority, revision, scope and session.",
    "Explicit user transfer must validate recipient acceptance for session, scope, revision and authority before changing ownership."],
  "current owner accountability": ["Until then, accountability remains with the current owner.",
    "The current owner stays accountable until then."],
  "prior owner stop": ["After acceptance, the prior owner stops.",
    "The prior owner stops after acceptance."],
  "transfer receipt boundary": ["Turn start alone or input acceptance cannot be a transfer receipt.",
    "Input acceptance and turn start alone are no transfer receipt."],
  "runtime identity mismatch": ["With a T3 threadId/runId mismatch, stop consuming and reconcile the driver identity with native state.",
    "A T3 threadId/runId mismatch requires the driver to stop consuming and reconcile driver identity with native state."],
  "identity forgery": ["Never bypass the mismatch by borrowing an identity or forging a sender.",
    "Never forge a sender or borrow an identity to bypass the mismatch."],
  "user takeover retention": ["A user-taken-over T3 thread is retained by the driver.",
    "Retention of a user-taken-over T3 thread is required of the driver."],
  "user takeover cleanup": ["Never send cleanup commands to it, including t3_thread_organize settle or archive.",
    "Never send cleanup commands including t3_thread_organize settle or archive to a user-taken-over thread."],
  "T3 settle evidence": ["Before t3_thread_organize settle or archive, require T3 terminal run evidence.",
    "Require T3 terminal run evidence before t3_thread_organize settle or archive."],
  "T3 metadata boundary": ["Worktree removal is not performed by these metadata actions.",
    "These metadata actions are not worktree removal."],
  "cleanup preflight": ["For every Axstack project worktreeCleanup is off.",
    "Every Axstack project sets worktreeCleanup to off."],
  "cleanup readback": ["Where exposed, preflight uses t3_project_read.",
    "Where exposed, t3_project_read supplies the preflight check."],
  "cleanup limitation": ["Otherwise, record a limitation pointing to the documented installation setup step.",
    "Otherwise a limitation must be recorded against the documented installation setup step."],
  "cleanup evidence priority": ["Automatic worktree deletion cannot replace salvage and evidence readback.",
    "Automatic worktree deletion cannot replace evidence readback or salvage."],
  "run record": ["Host, driver threadId, projectId, T3 version, installed Axstack SHA, capabilities JSON path and scheduledTaskIds for each watch and manager schedule belong in the run record.",
    "The run record contains driver threadId, projectId, host, T3 version, installed Axstack SHA, capabilities JSON path and scheduledTaskIds for each watch and manager schedule."],
  "dispatch target record": ["Per dispatch, requested target, read-back, mechanism and key appear in the record.",
    "The record per dispatch lists key, mechanism, requested target and read-back."],
  "dispatch identity record": ["Use taskId/childThreadId/childRunId or threadId/runId/worktree/branch/base SHA.",
    "Dispatch identity is taskId/childThreadId/childRunId or threadId/runId/worktree/branch/base SHA."],
  "dispatch revision record": ["Base SHAs and candidate accompany the checkout path.",
    "The checkout path is associated with candidate and base SHAs."],
  "dispatch evidence record": ["Next and hold join pending receipts, owner, scope/authority and evidence folder.",
    "Evidence folder, scope/authority, owner, pending receipts, hold and Next are recorded."],
  "native runtime boundary": ["The boundary has no Axstack daemon, DB, lock or scheduler.",
    "No Axstack daemon, DB, lock or scheduler belongs in the boundary."],
  "publication authority": ["Before sharing, private evidence requires explicit publication authority.",
    "Explicit publication authority is required for private evidence before sharing."],
  "receipt authority": ["Receipts grant no merge, release, publication, model-substitution, host-mutation or expanded scope authority.",
    "There is no merge, release, publication, model-substitution, host-mutation or expanded scope authority in receipts."],
  "human merge authority": ["By default the human merges.",
    "Merging is done by the human by default."],
};
const rules = definitions.map(([name, concepts, prohibition]) => ({
  name, concepts, prohibition, holdouts: holdouts[name],
}));

// Swap operands rather than just negating the temporal token. Fronted clauses
// have a separate shape so "Before B, A" receives the same sensitivity check.
function clauseSwaps(text) {
  text = text.replace(/[.;]\s*$/, '');
  const fronted = text.match(/^(before|after|until|once)\s+(.+?)\s+((?:the|a|each)\s+\S+\s+(?:must|shall|can)\b.+)$/i)
    ?? text.match(/^(before|after|until|once)\s+(.+?),\s*(.+)$/i);
  if (fronted) return [`${fronted[1]} ${fronted[3]}, ${fronted[2]}`];
  const infix = text.match(/^(.+?)\s+\b(before|after|until|once|then)\b\s+(.+)$/i)
    ?? text.match(/^(.+?)\s+\b(and)\b\s+(.+)$/i);
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
    ['owner', 'worker'], ['reviewer', 'author'], ['reviewers', 'authors'], ['writers', 'reviewers'],
    ['children', 'writers'], ['user', 'agent']].flatMap(([actor, other]) => {
    const pattern = new RegExp(`\\b${actor}\\b`, 'gi');
    return pattern.test(text) ? [text.replace(pattern, `${other} rather than the ${actor}`)] : [];
  }),
  text.replace(/\bto (?:that|the same) author\b/i, 'from that author to a replacement'),
].filter((changed) => changed !== text);
const antonymTransforms = [
  [/\beligible\b/gi, 'ineligible'], [/incomplete\b/gi, 'complete'],
  [/\bcompleted\b/gi, 'uncompleted'], [/\brunning\b/gi, 'unrunning'],
  [/\buntouched\b/gi, 'touched'], [/\bread-only\b/gi, 'writable after read-only setup'],
  [/\bpreserved\b/gi, 'unpreserved'], [/\brequir(?:e|es|ed|ing)\b/gi, 'unrequired'],
  [/\bstable\b/gi, 'unstable'], [/\bkept\b/gi, 'unkept'],
  [/\bowned\b/gi, 'unowned'], [/\bvalidated\b/gi, 'unvalidated'],
  [/\barmed\b/gi, 'unarmed'], [/\bexact\b(?!ly)/gi, 'inexact'],
  [/\bnewest\b/gi, 'oldest'], [/\bholds?\b/gi, 'releases any hold on'],
  [/\bheld\b/gi, 'released from hold'],
];
const scopeLimits = (text) => text.replace(/\bthrough(?:out)?\s+(\w+)/i, 'only until $1 begins');
const antonyms = (text) => antonymTransforms.map(([pattern, replacement]) => text.replace(pattern, replacement))
  .filter((changed) => changed !== text);

for (const rule of rules) {
  test(`T3 class fixtures: ${rule.name}`, () => {
    const text = rule.holdouts[1];
    if (orderingRules.has(rule.name)) {
      expect(clauseSwaps(text).length, rule.name).toBeGreaterThan(0);
      for (const changed of clauseSwaps(text)) expect(accepts(changed, rule), changed).toBe(false);
    }
    if (actorRules.has(rule.name)) {
      expect(actorSwaps(text).length, rule.name).toBeGreaterThan(0);
      for (const changed of actorSwaps(text)) expect(accepts(changed, rule), changed).toBe(false);
    }
    if (rule.name === 'reserved branch') expect(accepts(scopeLimits(text), rule)).toBe(false);
    for (const changed of antonyms(text)) expect(accepts(changed, rule), changed).toBe(false);
  });
}

for (const [name, inversion] of [
  ['claude effort', 'Claude effort must use option ID reasoningEffort.'],
  ['grok effort', 'Grok effort must exclude reasoningEffort and use max.'],
  ['reserved branch', 'Through recovery keep the reserved branch only until recovery begins.'],
]) {
  test(`T3 operand relation: ${name}`, () => {
    expect(accepts(inversion, rules.find((rule) => rule.name === name))).toBe(false);
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
  [/is a hold\b/gi, 'is not a hold'], [/\b(?:holds?|held)\b/gi, 'proceeds'],
  [/commit SHA|branch name/gi, (word) => /commit/i.test(word) ? 'branch name' : 'commit SHA'],
  [/:(?:false|true)\b/g, (word) => word === ':false' ? ':true' : ':false'],
  [/\bexclude\b/gi, 'include'],
];
const inversions = (text) => [...transformations.map(([pattern, replacement]) => text.replace(pattern, replacement)),
  `Do not follow this instruction: ${text}`].filter((changed) => changed !== text);

expect(Object.keys(holdouts).sort()).toEqual(rules.map(({ name }) => name).sort());
for (const rule of rules) {
  test(`T3 sentence: ${rule.name} rejects removal/inversion and accepts holdout`, () => {
    const source = sentences(runtime());
    const matching = source.filter((sentence) => accepts(sentence, rule));
    expect(matching.length, `missing rule: ${rule.name}`).toBeGreaterThan(0);
    for (const holdout of rule.holdouts) expect(accepts(holdout, rule), holdout).toBe(true);
    for (const sentence of [...matching, ...rule.holdouts]) {
      for (const changed of inversions(sentence)) {
        expect(accepts(changed, rule), `${rule.name}: ${changed}`).toBe(false);
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
    ['reserved branch', [/ke(?:ep|pt)/i, /reserved branch/i]],
    ['relaunch absence', [/relaunch once/i, /proven absence/i]],
    ['recovery hold', [/matches/i, /incomplete inventory/i, /hold/i]],
  ],
  'silent-provisioning-failure': [
    ['post-launch wait', [/launch failure/i]],
    ['timed-out started', [/activeRunId/, /worktreePath/, /started/i]],
    ['preparing hold', [/still preparing/i, /hold/i, /next wake/i]],
  ],
  'writer-death-after-idle': [
    ['watch failure', [/failed run/i, /hold/i, /\bincomplete/i]],
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
      const rule = rules.find((rule) => rule.name === name);
      expect(rule, name).toBeDefined();
      expect(accepts(runtime(), rule), `${scenario.id}: ${name}`).toBe(true);
    }
    for (const [name, concepts] of actions[scenario.id]) {
      expect(concepts.every((concept) => concept.test(scenario.expected.action)), `${scenario.id}: action ${name}`).toBe(true);
      const rule = rules.find((rule) => rule.name === name);
      const instruction = sentences(runtime()).find((sentence) => accepts(sentence, rule));
      expect(concepts.every((concept) => concept.test(instruction)), name).toBe(true);
      for (const concept of concepts) {
        const removed = scenario.expected.action.replace(new RegExp(concept.source, 'gi'), '');
        expect(concepts.every((check) => check.test(removed)), `${scenario.id}: removed action`).toBe(false);
      }
    }
  }
});
