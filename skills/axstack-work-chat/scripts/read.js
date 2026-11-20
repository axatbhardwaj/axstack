#!/usr/bin/env bun
import { lstatSync } from 'node:fs';
import { readLiveMessage } from './live.js';

const usage = `Usage: bun read.js message <permalink>
       bun read.js thread <permalink> <from> <until>
       bun read.js transcript <absolute JSONL file> <from> <until>

Windows are inclusive at the start and exclusive at the end.
Threads include only visible rows in the pane containing the exact parent.
A live read uses the dedicated iosatellite Chromium profile and may mark a message read.
It starts one local stdio server and Chromium, updates the dedicated profile,
and creates, then removes, a private scratch directory for transient browser state.
Only the scoped excerpts go to stdout. No login prompt, browser dump or chat action is provided.`;

const maxTranscriptBytes = 1024 * 1024;
const maxMessages = 25;
const maxExcerptLength = 1500;

function parseTime(value) {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  return typeof value === 'string' && iso.test(value) ? Date.parse(value) : NaN;
}

export function parsePermalink(input) {
  const url = URL.parse(input);
  if (url?.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;

  const slack = url.pathname.match(/^\/archives\/([CDG][A-Z0-9]{8,})\/p(\d{16})$/);
  if (slack && /^[a-z0-9-]+\.slack\.com$/.test(url.hostname)) {
    const [, conversation, id] = slack;
    const thread = url.searchParams.get('thread_ts');
    const channel = url.searchParams.get('cid');
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length || keys.some((key) => !['thread_ts', 'cid'].includes(key))) return null;
    if ((channel !== null && channel !== conversation) ||
        (thread !== null && !/^\d{10}\.\d{6}$/.test(thread))) return null;
    const messageId = id.slice(0, 10) + '.' + id.slice(10);
    return {
      url: url.href,
      service: 'slack',
      conversation,
      messageId,
      thread: thread ?? messageId,
      timestamp: new Date(Number(id.slice(0, 13))).toISOString(),
      selector: `[data-item-key="${messageId}"] [data-qa="message-text"]`,
    };
  }

  const teams = url.pathname.match(/^\/l\/message\/([a-zA-Z0-9_.%+@:-]+)\/(\d{13})$/);
  if (!teams || !['teams.microsoft.com', 'teams.cloud.microsoft'].includes(url.hostname)) return null;
  // Rebuild from identifiers so display metadata and client launch options cannot change the read.
  const [, encodedConversation, messageId] = teams;
  const conversation = decodeURIComponent(encodedConversation);
  if (!/^19:[a-z0-9_.+:-]+@(?:thread\.(?:v2|tacv2|skype)|unq\.gbl\.spaces|conference)$/i.test(conversation)) return null;
  const tenant = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if (!tenant.test(url.searchParams.get('tenantId') ?? '')) return null;
  const keys = [...url.searchParams.keys()];
  if (new Set(keys).size !== keys.length || keys.some((key) =>
    !['tenantId', 'groupId', 'parentMessageId', 'teamName', 'channelName', 'createdTime'].includes(key))) return null;
  if (url.searchParams.has('groupId') && !tenant.test(url.searchParams.get('groupId'))) return null;
  if (url.searchParams.has('parentMessageId') && !/^\d{13}$/.test(url.searchParams.get('parentMessageId'))) return null;
  const thread = url.searchParams.get('parentMessageId') ?? messageId;
  for (const key of ['teamName', 'channelName', 'createdTime']) url.searchParams.delete(key);
  return {
    url: url.href,
    service: 'teams',
    conversation,
    messageId,
    thread,
    timestamp: new Date(Number(messageId)).toISOString(),
    selector: `[id="message-body-${messageId}"]`,
  };
}

function readThreadScope(scope, from, until) {
  const start = parseTime(from);
  const end = parseTime(until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('Supply an increasing RFC 3339 window with offsets for the thread.');
  }
  const url = new URL(scope.url);
  if (scope.service === 'slack') {
    url.pathname = `/archives/${scope.conversation}/p${scope.thread.replace('.', '')}`;
    url.searchParams.set('thread_ts', scope.thread);
    url.searchParams.set('cid', scope.conversation);
  } else {
    url.pathname = url.pathname.replace(/\d{13}$/, scope.thread);
    url.searchParams.set('parentMessageId', scope.thread);
  }
  return { ...parsePermalink(url.href), window: { start, end } };
}

async function readTranscript(path, from, until) {
  const start = parseTime(from);
  const end = parseTime(until);
  if (!path.startsWith('/') || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('Supply an absolute transcript path and an increasing RFC 3339 window with offsets.');
  }
  const source = path.split('/').at(-1);
  const result = { source, from: new Date(start).toISOString(), until: new Date(end).toISOString(), messages: [] };
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.size > maxTranscriptBytes) throw new Error();
    const input = await Bun.file(path).slice(0, maxTranscriptBytes + 1).arrayBuffer();
    if (input.byteLength > maxTranscriptBytes) throw new Error();
    for (const line of new TextDecoder('utf-8', { fatal: true }).decode(input).split('\n')) {
      if (!line.trim()) continue;
      const { timestamp, text } = JSON.parse(line);
      const time = parseTime(timestamp);
      if (!Number.isFinite(time) || typeof text !== 'string') throw new Error();
      if (time < start || time >= end) continue;
      result.messages.push({
        timestamp: new Date(time).toISOString(),
        text: text.slice(0, maxExcerptLength),
        ...(text.length > maxExcerptLength ? { truncated: true } : {}),
      });
      if (result.messages.length > maxMessages) break;
    }
  } catch {
    throw new Error('Supply a readable JSONL transcript with timestamp and text fields, up to 1 MiB.');
  }
  if (result.messages.length > maxMessages) throw new Error('Too many messages in the window. Supply a narrower window.');
  result.messages.sort((first, second) => first.timestamp.localeCompare(second.timestamp));
  return result;
}

if (import.meta.main) {
  const [mode, source, from, until, ...extra] = process.argv.slice(2);
  try {
    if (mode === '--help' && source === undefined) console.log(usage);
    else if (mode === 'transcript' && until !== undefined && !extra.length) {
      console.log(JSON.stringify(await readTranscript(source, from, until)));
    } else if (source !== undefined && ((mode === 'message' && from === undefined) ||
      (mode === 'thread' && until !== undefined && !extra.length))) {
      let scope;
      try {
        scope = parsePermalink(source);
      } catch {
        // Malformed percent escapes also fail the same scope check.
      }
      if (!scope) throw new Error('Supply one supported Slack or Teams message permalink.');
      if (mode === 'thread') {
        const thread = readThreadScope(scope, from, until);
        const result = await readLiveMessage(thread, maxExcerptLength);
        console.log(JSON.stringify({
          source: thread.url,
          from: new Date(thread.window.start).toISOString(),
          until: new Date(thread.window.end).toISOString(),
          ...result,
        }));
      } else {
        const message = await readLiveMessage(scope, maxExcerptLength);
        console.log(JSON.stringify({ source: scope.url, timestamp: scope.timestamp, ...message }));
      }
    } else throw new Error(usage);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
