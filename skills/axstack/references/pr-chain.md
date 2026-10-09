# Ordinary PR chains

Record ordinary-chain or legacy-native-stack identity and direct dependencies.
Ordinary PRs/chains are the default. Unknown or mixed identity holds
affected operations. Use `gh stack` only for legacy-native-stack operations,
probe `gh stack --help` first. Preserve publication, linear-history, full-stack
merge, pinning and no-retarget rules under
[watch §5](../../axstack-watch/SKILL.md#5-state-readiness-precisely).
No automatic live unstacking. Singleton eligibility unchanged.

Children start from reviewed parent. For ordinary chains, merge parent
or base into owned child preserving existing commits. Immediately
invalidate affected child readiness. Refresh next ready children and direct
dependencies as needed, batching ancestor changes. Re-run affected checks and
remeasure shape against new base; size growth alone is not an automatic hold.
Legacy children retain reviewed-parent rebasing and revalidation.
Ordinary chains/legacy stacks: repair lowest affected ancestor first,
then refresh/revalidate children as needed.

## Integration

Only ready chain roots merge into integration targets. Never merge a child into
an open parent branch. A ready parent can merge before child publication or
readiness for independently deliverable approved scope. Apply watch §5
personal/work eligibility and user-only categories. Latest integration tip
must enter child history before merge.

After confirmed parent merge, verify reviewed head equals actual head and
is reachable from integration result. Mismatch: serious-risk hold.
Direct children: reread old head and base, change only base, read back
unchanged head and new base. Use `gh pr edit <child> --base <integration>` only
after confirming old base is parent branch and recorded head matches.
Retarget direct children only; prove forge auto-retargeting likewise.
Unknown retarget outcome: lookup before retry. Closed without merge,
rewritten parents, external squash or rebase, and missing ancestry hold dependents.

Bind evidence to PR, head, base branch identity and base SHA. Base-only retarget
or base update needs fresh applicable review, diligence, shape, CI and
approval evaluation. Check new-base workflow coverage at unchanged heads;
never reuse old-base receipts. Carryover compares stable patch-id at both recorded
head/base
identities and requires a forge-counted human approval under watch §5. Never
automatically request human rereview.

## Retirement

Branch retirement checks published and unpublished dependencies, active authors
and complete open-PR inventory. Unknown consumers hold deletion, never safe
independent parent integration. Resolve/read back all consumers before deletion.
Keep auto-delete off; omit
merge-time deletion for present/uncertain consumers.
