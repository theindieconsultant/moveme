// Move ♥ Me: saves quiz answers, questions and comments from the map site into this Google Sheet.
// Quiz answers   → "Responses" tab (unchanged behaviour)
// Questions      → "Questions" tab
// Comments       → "Comments" tab
// Columns are matched by their heading text, so you can reorder or add columns safely.

const NOTE_TABS = { question: 'Questions', comment: 'Comments' };

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);   // two visitors posting at the same moment never overwrite each other
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.getActive();
    if (d.type === 'question' || d.type === 'comment') return saveNote(ss, d);
    return saveQuiz(ss, d);
  } finally {
    lock.releaseLock();
  }
}

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
    const heads = ['Timestamp', 'Map', 'Topic', 'About', 'Place type', 'State', d.type === 'question' ? 'Question' : 'Comment'];
    sheet.appendRow(heads);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, heads.length).setFontWeight('bold');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valueFor = (heading) => {
    const h = String(heading).toLowerCase().trim();
    if (h.startsWith('time') || h === 'date') return new Date();
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

// ---------- quiz answers (same as before) ----------
function saveQuiz(ss, d) {
  const sheet = ss.getSheetByName('Responses');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valueFor = (heading) => {
    const h = String(heading).toLowerCase();
    if (h.startsWith('time')) return new Date();
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
