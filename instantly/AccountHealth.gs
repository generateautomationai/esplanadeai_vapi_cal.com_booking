/**
 * AccountHealth pull for "Instantly Campaign and Email Health Data".
 *
 * Writes one row per Instantly sending inbox to the AccountHealth tab.
 * Each row shows whether the inbox is assigned to an active campaign.
 *
 * Setup:
 * 1. Open the sheet. Go to Extensions > Apps Script. Paste this file.
 * 2. Project Settings > Script Properties. Add INSTANTLY_API_KEY (an Instantly v2 key).
 * 3. Run pullAccountHealth once and approve the permissions.
 * 4. Run installDailyTrigger to refresh every morning.
 */

const IA_BASE = 'https://api.instantly.ai/api/v2';
const IA_TAB = 'AccountHealth';
const IA_SUMMARY_TAB = 'AccountSummary';
const IA_SEND_WINDOW_DAYS = 7;

const IA_ACCOUNT_STATUS = { 1: 'Active', 2: 'Paused', '-1': 'Connection Error', '-2': 'Soft Bounce Error', '-3': 'Sending Error' };
const IA_WARMUP_STATUS = { 0: 'Paused', 1: 'Active', '-1': 'Banned', '-2': 'Spam Folder Unknown', '-3': 'Permanent Suspension' };
const IA_CAMPAIGN_STATUS = { 0: 'Draft', 1: 'Active', 2: 'Paused', 3: 'Completed', 4: 'Running Subsequences', '-1': 'Accounts Unhealthy', '-2': 'Bounce Protect', '-99': 'Suspended' };

function pullAccountHealth() {
  const pulledAt = new Date().toISOString();
  const accounts = iaPaginate_('/accounts', { limit: 100 });
  const campaigns = iaPaginate_('/campaigns', { limit: 100 });
  const emails = accounts.map(a => a.email);

  // Map each inbox to the campaigns that list it, grouped by campaign status.
  const byInbox = {};
  campaigns.forEach(c => {
    const label = IA_CAMPAIGN_STATUS[c.status] || String(c.status);
    (c.email_list || []).forEach(e => {
      const key = String(e).toLowerCase();
      byInbox[key] = byInbox[key] || { active: [], other: [] };
      if (c.status === 1) byInbox[key].active.push(c.name);
      else byInbox[key].other.push(c.name + ' (' + label + ')');
    });
  });

  const warmup = iaWarmupAnalytics_(emails);
  const daily = iaDailySends_(emails);

  const header = [
    'Pulled At', 'Email', 'Domain', 'In Use', 'Account Status', 'Warmup Status',
    'Warmup Health Score', 'Warmup Inbox %', 'Warmup Spam %', 'Daily Limit',
    'Sent Last 7d', 'Bounced Last 7d', 'Bounce Rate 7d %', 'Active Campaigns',
    'Other Campaigns', 'Last Used', 'Created', 'Flags'
  ];

  const rows = accounts.map(a => {
    const email = String(a.email).toLowerCase();
    const camp = byInbox[email] || { active: [], other: [] };
    const w = warmup[email] || {};
    const d = daily[email] || { sent: 0, bounced: 0 };
    const inUse = camp.active.length > 0 ? 'Yes' : 'No';
    const landed = (w.landed_inbox || 0) + (w.landed_spam || 0);
    const inboxPct = landed ? round_(100 * w.landed_inbox / landed) : '';
    const spamPct = landed ? round_(100 * w.landed_spam / landed) : '';
    const bounceRate = d.sent ? round_(100 * d.bounced / d.sent) : 0;
    const score = w.health_score != null ? w.health_score : (a.stat_warmup_score != null ? a.stat_warmup_score : '');

    const flags = [];
    if (a.status !== 1) flags.push('Account not active');
    if (a.warmup_status !== 1) flags.push('Warmup off');
    if (score !== '' && score < 90) flags.push('Low warmup score');
    if (spamPct !== '' && spamPct > 10) flags.push('High spam placement');
    if (bounceRate > 3) flags.push('High bounce rate');
    if (inUse === 'No' && a.status === 1 && a.warmup_status === 1 && (score === '' || score >= 90)) flags.push('Ready but idle');

    return [
      pulledAt, a.email, email.split('@')[1] || '', inUse,
      IA_ACCOUNT_STATUS[a.status] || String(a.status),
      IA_WARMUP_STATUS[a.warmup_status] || String(a.warmup_status),
      score, inboxPct, spamPct, a.daily_limit || '',
      d.sent, d.bounced, bounceRate,
      camp.active.join('; '), camp.other.join('; '),
      a.timestamp_last_used || '', a.timestamp_created || '', flags.join('; ')
    ];
  });

  // In-use inboxes first, then alphabetical by domain and email.
  rows.sort((x, y) => (x[3] === y[3] ? 0 : x[3] === 'Yes' ? -1 : 1) || x[2].localeCompare(y[2]) || x[1].localeCompare(y[1]));

  writeTab_(IA_TAB, [header].concat(rows));
  writeSummary_(pulledAt, rows);
}

function writeSummary_(pulledAt, rows) {
  const used = rows.filter(r => r[3] === 'Yes').length;
  const ready = rows.filter(r => r[17].indexOf('Ready but idle') >= 0).length;
  const flagged = rows.filter(r => r[17] && r[17] !== 'Ready but idle').length;
  const domains = {};
  rows.forEach(r => {
    domains[r[2]] = domains[r[2]] || { total: 0, used: 0 };
    domains[r[2]].total++;
    if (r[3] === 'Yes') domains[r[2]].used++;
  });
  const out = [
    ['Pulled At', pulledAt],
    ['Total Inboxes', rows.length],
    ['In Use (active campaign)', used],
    ['Not In Use', rows.length - used],
    ['Not In Use but Ready', ready],
    ['Inboxes With Problems', flagged],
    ['', ''],
    ['Domain', 'Inboxes', 'In Use', 'Not In Use']
  ].map(r => r.concat(new Array(4 - r.length).fill('')));
  Object.keys(domains).sort().forEach(k => out.push([k, domains[k].total, domains[k].used, domains[k].total - domains[k].used]));
  writeTab_(IA_SUMMARY_TAB, out);
}

function iaWarmupAnalytics_(emails) {
  const result = {};
  for (let i = 0; i < emails.length; i += 100) {
    const res = iaFetch_('/accounts/warmup-analytics', 'post', { emails: emails.slice(i, i + 100) });
    const agg = (res && res.aggregate_data) || {};
    Object.keys(agg).forEach(k => { result[k.toLowerCase()] = agg[k]; });
  }
  return result;
}

function iaDailySends_(emails) {
  const end = new Date();
  const start = new Date(end.getTime() - IA_SEND_WINDOW_DAYS * 86400000);
  const fmt = d => Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  const result = {};
  for (let i = 0; i < emails.length; i += 50) {
    const query = { start_date: fmt(start), end_date: fmt(end) };
    const qs = toQuery_(query) + '&' + emails.slice(i, i + 50).map(e => 'emails=' + encodeURIComponent(e)).join('&');
    const res = iaFetch_('/accounts/analytics/daily?' + qs, 'get');
    (Array.isArray(res) ? res : (res && res.items) || []).forEach(row => {
      const key = String(row.email_account || row.email || '').toLowerCase();
      result[key] = result[key] || { sent: 0, bounced: 0 };
      result[key].sent += Number(row.sent || 0);
      result[key].bounced += Number(row.bounced || 0);
    });
  }
  return result;
}

function iaPaginate_(path, params) {
  const all = [];
  let cursor = null;
  for (let page = 0; page < 100; page++) {
    const q = Object.assign({}, params);
    if (cursor) q.starting_after = cursor;
    const res = iaFetch_(path + '?' + toQuery_(q), 'get');
    const items = (res && res.items) || [];
    all.push.apply(all, items);
    cursor = res && res.next_starting_after;
    if (!cursor || items.length === 0) break;
  }
  return all;
}

function iaFetch_(path, method, body) {
  const key = PropertiesService.getScriptProperties().getProperty('INSTANTLY_API_KEY');
  if (!key) throw new Error('Set INSTANTLY_API_KEY in Script Properties.');
  const opts = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + key } };
  if (body) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(body); }
  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = UrlFetchApp.fetch(IA_BASE + path, opts);
    const code = resp.getResponseCode();
    if (code === 429 || code >= 500) { Utilities.sleep(2000 * Math.pow(2, attempt)); continue; }
    if (code >= 400) throw new Error('Instantly ' + code + ' on ' + path + ': ' + resp.getContentText().slice(0, 300));
    return JSON.parse(resp.getContentText() || '{}');
  }
  throw new Error('Instantly kept rate limiting ' + path);
}

function writeTab_(name, values) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (values.length) sh.getRange(1, 1, values.length, values[0].length).setValues(values);
  sh.setFrozenRows(1);
}

function toQuery_(obj) {
  return Object.keys(obj).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');
}

function round_(n) { return Math.round(n * 10) / 10; }

function installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'pullAccountHealth')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pullAccountHealth').timeBased().everyDays(1).atHour(7).create();
}
