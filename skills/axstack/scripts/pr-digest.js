#!/usr/bin/env bun
import { readFileSync } from 'node:fs';

const queryFields = `
  number headRefOid baseRefOid body isDraft state mergeable
  commits(last: 1) { pageInfo { hasNextPage } nodes { commit {
    statusCheckRollup { contexts(first: 100) { pageInfo { hasNextPage } nodes {
      ... on CheckRun { id name status conclusion startedAt completedAt
        checkSuite { app { slug } workflowRun { databaseId runNumber runAttempt } } }
      ... on StatusContext { id context state createdAt }
    } } }
  } } }
  reviews(first: 100) { pageInfo { hasNextPage } nodes {
    id state body updatedAt submittedAt author { login }
  } }
  reviewRequests(first: 100) { pageInfo { hasNextPage } nodes {
    requestedReviewer { ... on User { login } ... on Team { slug } }
  } }
  comments(first: 100) { pageInfo { hasNextPage } nodes { id body updatedAt isMinimized } }
  reviewThreads(first: 100) { pageInfo { hasNextPage } nodes {
    id isResolved isCollapsed comments(first: 100) {
      pageInfo { hasNextPage } nodes { id body updatedAt }
    }
  } }
  labels(first: 100) { pageInfo { hasNextPage } nodes { id name } }
`;

function options(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--input', '--watermark', '--repo', '--prs'].includes(argv[i]) || !argv[i + 1] || result[argv[i]]) {
      throw new Error(`invalid argument: ${argv[i] ?? '(end)'}`);
    }
    result[argv[i]] = argv[i + 1];
  }
  if (!result['--watermark'] || (!result['--input'] && (!result['--repo'] || !result['--prs']))) {
    throw new Error('expected --watermark path and either --input path or --repo owner/name --prs 1,2');
  }
  return result;
}

function fetchCurrent(args) {
  if (args['--input']) return JSON.parse(readFileSync(args['--input'], 'utf8'));
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(args['--repo']);
  const numbers = args['--prs'].split(',').map(Number);
  if (!match || !numbers.length || numbers.some((number) => !Number.isSafeInteger(number) || number < 1)) {
    throw new Error('expected valid --repo owner/name and --prs 1,2');
  }
  const selections = numbers.map((number, index) => `pr${index}: pullRequest(number: ${number}) { ${queryFields} }`);
  const query = `query { repository(owner: ${JSON.stringify(match[1])}, name: ${JSON.stringify(match[2])}) { ${selections.join('\n')} } }`;
  const result = Bun.spawnSync(['gh', 'api', 'graphql', '-f', `query=${query}`], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(`GitHub GraphQL failed: ${result.stderr.toString().trim()}`);
  return JSON.parse(result.stdout.toString());
}

function nodes(connection, field) {
  if (connection?.pageInfo?.hasNextPage !== false || !Array.isArray(connection.nodes)) {
    throw new Error(`incomplete ${field} connection`);
  }
  return connection.nodes;
}

const digest = (body) => new Bun.CryptoHasher('sha256').update(body ?? '').digest('hex');
const ordered = (items) => items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const bodyItem = ({ body, ...rest }) => ({ ...rest, bodyDigest: digest(body) });

function snapshot(response) {
  if (response.errors?.length || !response.data?.repository) throw new Error('incomplete GraphQL response');
  const prs = {};
  for (const pr of Object.values(response.data.repository)) {
    if (!pr || !Number.isSafeInteger(pr.number) || !pr.headRefOid || !pr.baseRefOid) {
      throw new Error('incomplete pull request');
    }
    const commits = nodes(pr.commits, 'commits');
    const rollup = commits[0]?.commit?.statusCheckRollup;
    const checks = rollup ? nodes(rollup.contexts, 'checks') : [];
    const threads = nodes(pr.reviewThreads, 'reviewThreads').map((thread) => ({
      id: thread.id, isResolved: thread.isResolved, isCollapsed: thread.isCollapsed,
      comments: ordered(nodes(thread.comments, 'thread comments').map(bodyItem)),
    }));
    prs[pr.number] = {
      headRefOid: pr.headRefOid, baseRefOid: pr.baseRefOid,
      bodyDigest: digest(pr.body), isDraft: pr.isDraft, state: pr.state, mergeable: pr.mergeable,
      checks: ordered(checks),
      reviews: ordered(nodes(pr.reviews, 'reviews').map(bodyItem)),
      reviewRequests: ordered(nodes(pr.reviewRequests, 'reviewRequests')),
      comments: ordered(nodes(pr.comments, 'comments').map(bodyItem)),
      reviewThreads: ordered(threads),
      labels: ordered(nodes(pr.labels, 'labels')),
    };
  }
  return prs;
}

try {
  const args = options(process.argv.slice(2));
  const current = snapshot(fetchCurrent(args));
  let previous = {};
  try {
    previous = JSON.parse(readFileSync(args['--watermark'], 'utf8'));
    if (previous?.data) previous = snapshot(previous);
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('invalid watermark');
  const changes = [];
  for (const number of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    const before = previous[number] ?? {};
    const after = current[number] ?? {};
    const fields = Object.keys({ ...before, ...after }).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    if (fields.length) changes.push({ number: Number(number), fields });
  }
  if (changes.length) {
    // The driver saves this watermark only after it has reconciled the deltas and pending local work.
    console.log(JSON.stringify({ changes, watermark: current }));
    process.exitCode = 10;
  }
} catch (error) {
  console.error(`PR digest incomplete: ${error.message}`);
  process.exitCode = 2;
}
