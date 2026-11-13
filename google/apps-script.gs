// Move ♥ Me: saves quiz answers, questions and comments from the map site into this Google Sheet.
// Quiz answers   → "Responses" tab (unchanged behaviour)
// Questions      → "Questions" tab
// Comments       → "Comments" tab
// Feedback       → emailed to Heatherlee + logged in the "Feedback" tab
// Columns are matched by their heading text, so you can reorder or add columns safely.
// Every tab gets a "Source" column (added automatically if missing) saying which copy of the site
// sent the row: "GitHub", "Lovable", "Claude preview", or the site's web address.

const NOTE_TABS = { question: 'Questions', comment: 'Comments' };
const FEEDBACK_TO = 'heatherlee.ux@gmail.com';
const FEEDBACK_SUBJECT = 'Feedback from Move <3 Me Site';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);   // two visitors posting at the same moment never overwrite each other
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.getActive();
    if (d.type === 'feedback' || d.placeType === 'feedback') return saveFeedback(ss, d);
    if (d.type === 'question' || d.type === 'comment') return saveNote(ss, d);
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
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valueFor = (heading) => {
    const h = String(heading).toLowerCase();
    if (h.startsWith('time')) return new Date();
    if (h.includes('source')) return sourceOf(d);
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
