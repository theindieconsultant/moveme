// Move ♥ Me: saves quiz answers, questions and comments from the map site into this Google Sheet.
// Quiz answers   → "Responses" tab (unchanged behaviour)
// Questions      → "Questions" tab
// Comments       → "Comments" tab
// Feedback       → emailed to Heatherlee + logged in the "Feedback" tab
// Monie chats    → "Chats" tab, one row per conversation, updated after every reply
//                  (finished chats also save their answers to "Responses", with Via = Chat)
// LinkedIn links → "Contacts" tab, kept apart from the anonymous answers and chats, + an email to Heatherlee
// Columns are matched by their heading text, so you can reorder or add columns safely.
// Every tab gets a "Source" column (added automatically if missing) saying which copy of the site
// sent the row: "GitHub", "Lovable", "Claude preview", or the site's web address.

const SHEET_ID = '1x_eM6R9c-K9YXT7WC27A8SLqiw34gbNMQqDP4ulLTGw';   // your Move ♥ Me Sheet
const NOTE_TABS = { question: 'Questions', comment: 'Comments' };
const FEEDBACK_TO = 'heatherlee.ux@gmail.com';
const FEEDBACK_SUBJECT = 'Feedback from Move <3 Me Site';
const LINKEDIN_SUBJECT = 'Someone added their Linkedin to Move <3 Me';

// Visiting the web app address shows which version is live (handy after a new deployment).
// Add ?test=linkedin-email to the address to send yourself a sample LinkedIn email (at most once every 2 minutes).
function doGet(e) {
  if (e && e.parameter && e.parameter.test === 'linkedin-email') {
    const cache = CacheService.getScriptCache();
    if (cache.get('li-test')) return ContentService.createTextOutput('test email already sent, try again in 2 minutes');
    cache.put('li-test', '1', 120);
    emailContact('https://www.linkedin.com/in/heatherleenguyen/', { from: 'Card', map: 'love', reason: 'love', home: 'Chicago, IL', source: 'GitHub' }, true);
    return ContentService.createTextOutput('test email sent to ' + FEEDBACK_TO);
  }
  return ContentService.createTextOutput('Move ♥ Me script: chats version + contacts + email + remove (Nov 2026)');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);   // two visitors posting at the same moment never overwrite each other
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.openById(SHEET_ID);   // always this exact Sheet
    if (d.type === 'feedback' || d.placeType === 'feedback') return saveFeedback(ss, d);
    if (d.type === 'question' || d.type === 'comment') return saveNote(ss, d);
    if (d.type === 'chat') return saveChat(ss, d);
    if (d.type === 'contact') return d.remove ? removeContact(ss, d) : saveContact(ss, d);
    return saveQuiz(ss, d);
  } finally {
    lock.releaseLock();
  }
}

// Adds a "Source" heading at the end of row 1 if the tab doesn't have one yet.
function ensureSource(sheet) {
  const last = Math.max(sheet.getLastColumn(), 1);
  const heads = sheet.getRange(1, 1, 1, last).getValues()[0].map(h => String(h).toLowerCase());
  if (!heads.some(h => h.includes('source'))) sheet.getRange(1, last + 1).setValue('Source').setFontWeight('bold');
}
// Adds a heading at the end of row 1 if no heading contains `match` yet.
function ensureHeading(sheet, match, label) {
  const last = Math.max(sheet.getLastColumn(), 1);
  const heads = sheet.getRange(1, 1, 1, last).getValues()[0].map(h => String(h).toLowerCase());
  if (!heads.some(h => h.includes(match))) sheet.getRange(1, last + 1).setValue(label).setFontWeight('bold');
}
const sourceOf = d => clean(d.source || 'GitHub');   // rows from before tagging existed came from the GitHub site

// Trim, cap at 1,000 characters, and stop text that starts with = + - @ from running as a formula.
function clean(v) {
  v = String(v == null ? '' : v).slice(0, 1000).trim();
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

// ---------- questions & comments ----------
function saveNote(ss, d) {
  const text = clean(d.text);
  if (text.length < 3) return ContentService.createTextOutput('empty');
  const name = NOTE_TABS[d.type];
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  // A brand-new (empty) tab gets headings automatically.
  if (sheet.getLastRow() === 0) {
    const heads = ['Timestamp', 'Map', 'Topic', 'About', 'Place type', 'State', d.type === 'question' ? 'Question' : 'Comment', 'Source'];
    sheet.appendRow(heads);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, heads.length).setFontWeight('bold');
  }
  ensureSource(sheet);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valueFor = (heading) => {
    const h = String(heading).toLowerCase().trim();
    if (h.startsWith('time') || h === 'date') return new Date();
    if (h.includes('source')) return sourceOf(d);
    if (h.includes('map')) return d.map === 'career' ? 'Career' : 'Love';
    if (h.includes('topic')) return clean(d.topic);
    if (h.includes('type')) return clean(d.placeType);
    if (h === 'state' || h.startsWith('state')) return clean(d.state);
    if (h.includes('about') || h.includes('place') || h.includes('city') || h.includes('location')) return clean(d.place);
    if (h.includes('question') || h.includes('comment') || h.includes('text') || h.includes('message')) return text;
    return '';
  };
  sheet.appendRow(headers.map(valueFor));
  return ContentService.createTextOutput('ok');
}

// ---------- feedback (About page): email + backup row ----------
function saveFeedback(ss, d) {
  const rating = Math.max(0, Math.min(5, parseInt(d.rating, 10) || 0));
  const text = String(d.text == null ? '' : d.text).replace(/^\[\d\/5 stars\]\s*/, '').replace(/^\(no comment\)$/, '').slice(0, 2000).trim();
  if (!rating && text.length < 3) return ContentService.createTextOutput('empty');
  const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) + ' (' + rating + '/5)' : 'No rating';
  const when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
  // save first, so feedback is never lost even if the email can't be sent
  const sheet = ss.getSheetByName('Feedback') || ss.insertSheet('Feedback');
  if (sheet.getLastRow() === 0) { sheet.appendRow(['Timestamp', 'Rating', 'Feedback', 'Page', 'Source']); sheet.setFrozenRows(1); sheet.getRange(1, 1, 1, 5).setFontWeight('bold'); }
  ensureSource(sheet);
  const fh = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase());
  sheet.appendRow(fh.map(h => h.startsWith('time') ? new Date() : h.includes('rating') ? (rating || '') : h.includes('feedback') ? clean(text)
    : h.includes('page') ? clean(d.page) : h.includes('source') ? sourceOf(d) : ''));
  try {
    MailApp.sendEmail({
      to: FEEDBACK_TO,
      subject: FEEDBACK_SUBJECT,
      body: 'Rating: ' + stars + '\n\n' + (text || '(no comment)') + '\n\n—\nSent ' + when + ' from the Move ♥ Me site: ' + sourceOf(d) + ' (' + (d.page || '') + ', ' + (d.map === 'career' ? 'Career' : 'Love') + ' map).'
    });
  } catch (err) {
    console.error('Feedback email failed: ' + err);
    return ContentService.createTextOutput('saved, email failed');
  }
  return ContentService.createTextOutput('ok');
}

// ---------- quiz answers (same as before) ----------
function saveQuiz(ss, d) {
  const sheet = ss.getSheetByName('Responses');
  ensureSource(sheet);
  ensureHeading(sheet, 'via', 'Via');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valueFor = (heading) => {
    const h = String(heading).toLowerCase();
    if (h.startsWith('time')) return new Date();
    if (h.includes('source')) return sourceOf(d);
    if (h === 'via' || h.startsWith('via ')) return d.via === 'Chat' ? 'Chat' : 'Quiz';
    if (h.includes('love')) return d.reason || '';
    if (h.includes('mountain') || h.includes('beach') || h.includes('skyline')) return d.scene || '';
    if (h.startsWith('age')) return d.age || '';
    if (h.includes('sign') || h.includes('zodiac')) return d.sign || '';
    if (h.includes('industr')) return (d.industries || []).join('; ');
    if (h.includes('lives')) return d.home || '';
    if (h.includes('open')) return (d.places || []).join('; ');
    if (h.includes('comment')) return d.comment || '';
    return '';
  };
  sheet.appendRow(headers.map(valueFor));
  return ContentService.createTextOutput('ok');
}

// Run this once from the editor (pick "authorizeEmail" in the function menu, then Run).
// Google will ask permission to send email as you; after you allow it, a test email arrives.
function authorizeEmail() {
  MailApp.sendEmail(FEEDBACK_TO, FEEDBACK_SUBJECT, 'Test: Move ♥ Me site feedback emails are working. You can delete this email.');
}

// ---------- Monie chats: one row per conversation, found again by its Chat ID ----------
const CHAT_HEADS = ['Started', 'Last updated', 'Chat ID', 'Source', 'Map', 'Journey', 'Status', 'Messages', 'Misses', 'Transcript'];
function saveChat(ss, d) {
  const id = String(d.chatId || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  const transcript = String(d.transcript == null ? '' : d.transcript).slice(0, 45000).trim();
  if (!id || !transcript) return ContentService.createTextOutput('empty');
  const sheet = ss.getSheetByName('Chats') || ss.insertSheet('Chats');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CHAT_HEADS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, CHAT_HEADS.length).setFontWeight('bold');
    sheet.setColumnWidth(10, 520);
  }
  const heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase().trim());
  const col = name => heads.indexOf(name.toLowerCase()) + 1;
  const status = ({ finished: 'finished', left: 'left before finishing' })[d.status] || 'in progress';
  const values = {
    'last updated': new Date(), 'chat id': id, 'source': sourceOf(d), 'map': d.map === 'career' ? 'Career' : 'Love',
    'journey': d.reason === 'jobs' ? 'Work' : d.reason === 'love' ? 'Love' : '', 'status': status,
    'messages': Math.max(0, parseInt(d.messages, 10) || 0), 'misses': Math.max(0, parseInt(d.misses, 10) || 0),
    'transcript': /^[=+\-@]/.test(transcript) ? "'" + transcript : transcript
  };
  // same chat again? overwrite its row (keeping "Started"); otherwise add a new row
  const idCol = col('Chat ID');
  const hit = idCol && sheet.getLastRow() > 1
    ? sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext() : null;
  if (hit) {
    const row = hit.getRow();
    Object.keys(values).forEach(k => { const c = col(k); if (c) sheet.getRange(row, c).setValue(values[k]); });
  } else {
    values['started'] = new Date();
    sheet.appendRow(heads.map(h => values[h] === undefined ? '' : values[h]));
  }
  return ContentService.createTextOutput('ok');
}


// ---------- LinkedIn "stay in touch" links → Contacts tab ----------
// Only profile links (linkedin.com/in/…) are saved. Nothing here links back to a chat or quiz row.
function saveContact(ss, d) {
  const m = String(d.linkedin || '').match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]{2,100})/i);
  if (!m) return ContentService.createTextOutput('not a profile link');
  const url = 'https://www.linkedin.com/in/' + m[1] + '/';
  const sheet = ss.getSheetByName('Contacts') || ss.insertSheet('Contacts');
  if (sheet.getLastRow() === 0) {
    const heads = ['Timestamp', 'LinkedIn', 'From', 'Map', 'Journey', 'Industry', 'Lives in', 'Source'];
    sheet.appendRow(heads); sheet.setFrozenRows(1); sheet.getRange(1, 1, 1, heads.length).setFontWeight('bold');
  }
  const heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase());
  sheet.appendRow(heads.map(h => h.startsWith('time') ? new Date() : h.includes('linkedin') ? url : h === 'from' ? clean(d.from)
    : h.includes('map') ? (d.map === 'career' ? 'Career' : 'Love') : h.includes('journey') ? (d.reason === 'jobs' ? 'Jobs' : d.reason === 'love' ? 'Love' : '')
    : h.includes('industr') ? clean(d.industries) : h.includes('live') ? clean(d.home) : h.includes('source') ? sourceOf(d) : ''));
  emailContact(url, d, false);   // the row is saved first, so a failed email never loses the link
  return ContentService.createTextOutput('ok');
}

const WHERE = { Card: 'the "your move ♥ me" card on the map', Quiz: 'the end of the quick quiz', Chat: 'the end of the Monie chat' };
function emailContact(url, d, isTest) {
  const when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "EEE, MMM d, yyyy 'at' h:mm:ss a z");
  const lines = [
    (isTest ? '(This is a test email.)\n\n' : '') + 'Someone added their LinkedIn to Move ♥ Me.',
    '',
    'LinkedIn: ' + url,
    'Added from: ' + (WHERE[d.from] || clean(d.from) || 'the site') + ' (' + (d.map === 'career' ? 'Career' : 'Love') + ' map)',
    'Site: ' + sourceOf(d),
    'When: ' + when
  ];
  if (d.reason) lines.push('Journey: ' + (d.reason === 'jobs' ? 'Jobs' : 'Love'));
  if (d.industries) lines.push('Industry: ' + clean(d.industries));
  if (d.home) lines.push('Lives in: ' + clean(d.home));
  lines.push('', 'It\'s also saved in the Contacts tab of your Move ♥ Me Sheet.');
  try { MailApp.sendEmail({ to: FEEDBACK_TO, subject: (isTest ? '[Test] ' : '') + LINKEDIN_SUBJECT, body: lines.join('\n') }); }
  catch (err) { console.error('LinkedIn email failed: ' + err); }
}

// "remove link" on the site: delete that person's LinkedIn row(s) from Contacts
function removeContact(ss, d) {
  const m = String(d.linkedin || '').match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]{2,100})/i);
  const sheet = ss.getSheetByName('Contacts');
  if (!m || !sheet || sheet.getLastRow() < 2) return ContentService.createTextOutput('nothing to remove');
  const want = m[1].toLowerCase();
  const heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase());
  const col = heads.findIndex(h => h.includes('linkedin')) + 1;
  if (!col) return ContentService.createTextOutput('no LinkedIn column');
  const vals = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {   // bottom up, so row numbers stay right
    const v = String(vals[i][0]).match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]{2,100})/i);
    if (v && v[1].toLowerCase() === want) sheet.deleteRow(i + 2);
  }
  return ContentService.createTextOutput('removed');
}
