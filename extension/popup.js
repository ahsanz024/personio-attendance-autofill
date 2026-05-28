const strings = {
  en: {
    mainTitle: 'Personio Autofill',
    settings: 'Settings',
    work1: 'Work 1',
    break: 'Break',
    work2: 'Work 2',
    mode: 'Mode',
    emptyWorkdays: 'Empty workdays only',
    filled: 'Filled',
    skipped: 'Skipped',
    total: 'Total',
    fillBtn: 'Fill all empty days',
    fillBtnBusy: 'Filling days...',
    stopBtn: 'Stop',
    reloadBtn: 'Reload page',
    statusDefault: 'Click "Fill all empty days" to start.',
    footer: 'Runs on Personio monthly view only',
    labelWorkHours: 'Work hours',
    labelBreak: 'Break (lunch)',
    labelLanguage: 'Language',
    saveBtn: 'Save',
    saved: 'Settings saved!',
    noTab: 'No active Personio tab found.',
    connectionErr: 'Cannot reach Personio page. Please reload the page.',
    fillLogStart: 'Starting autofill...',
    summaryFmt: filled => `${filled} day(s) filled.`,
  },
  de: {
    mainTitle: 'Personio Autofill',
    settings: 'Einstellungen',
    work1: 'Arbeit 1',
    break: 'Pause',
    work2: 'Arbeit 2',
    mode: 'Modus',
    emptyWorkdays: 'Nur leere Werktage',
    filled: 'Gefüllt',
    skipped: 'Übersprungen',
    total: 'Gesamt',
    fillBtn: 'Alle leeren Tage füllen',
    fillBtnBusy: 'Fülle Tage...',
    stopBtn: 'Stop',
    reloadBtn: 'Seite neu laden',
    statusDefault: 'Klicke auf "Alle leeren Tage füllen" um zu starten.',
    footer: 'Läuft nur auf Personio Monatsansicht',
    labelWorkHours: 'Arbeitszeit',
    labelBreak: 'Pause (Mittag)',
    labelLanguage: 'Sprache',
    saveBtn: 'Speichern',
    saved: 'Einstellungen gespeichert!',
    noTab: 'Kein aktiver Personio-Tab gefunden.',
    connectionErr: 'Keine Verbindung zur Personio-Seite. Bitte lade die Seite neu.',
    fillLogStart: 'Starte Autofill...',
    summaryFmt: filled => `${filled} Tag(e) gefüllt.`,
  }
};

let lang = 'en';

function t(key, ...args) {
  let s = strings[lang]?.[key] || strings.en[key] || key;
  return typeof s === 'function' ? s(...args) : s;
}

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
}

// DOM refs
const mainView = document.getElementById('mainView');
const settingsView = document.getElementById('settingsView');
const settingsBtn = document.getElementById('settingsBtn');
const backBtn = document.getElementById('backBtn');
const fillBtn = document.getElementById('fillBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const btnLabel = document.getElementById('btnLabel');
const spinner = document.getElementById('spinner');
const summaryEl = document.getElementById('summary');
const sumFilled = document.getElementById('sumFilled');
const sumSkipped = document.getElementById('sumSkipped');
const sumTotal = document.getElementById('sumTotal');
const workStart = document.getElementById('workStart');
const workEnd = document.getElementById('workEnd');
const breakStart = document.getElementById('breakStart');
const breakEnd = document.getElementById('breakEnd');
const language = document.getElementById('language');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const saveFeedback = document.getElementById('saveFeedback');
const schedWork1 = document.getElementById('schedWork1');
const schedWork2 = document.getElementById('schedWork2');
const schedBreak = document.getElementById('schedBreak');

// Navigation
settingsBtn.addEventListener('click', () => {
  mainView.style.display = 'none';
  settingsView.style.display = 'block';
  loadSettings();
});

backBtn.addEventListener('click', () => {
  settingsView.style.display = 'none';
  mainView.style.display = 'block';
});

// Load settings from storage
async function loadSettings() {
  const stored = await chrome.storage.sync.get({
    workStart: '09:00',
    workEnd: '18:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    language: 'en'
  });
  workStart.value = stored.workStart;
  workEnd.value = stored.workEnd;
  breakStart.value = stored.breakStart;
  breakEnd.value = stored.breakEnd;
  language.value = stored.language;
  lang = stored.language;
  applyLanguage();
  updateScheduleDisplay();
  saveFeedback.textContent = '';
}

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
  const settings = {
    workStart: workStart.value,
    workEnd: workEnd.value,
    breakStart: breakStart.value,
    breakEnd: breakEnd.value,
    language: language.value
  };
  await chrome.storage.sync.set(settings);
  lang = settings.language;
  applyLanguage();
  updateScheduleDisplay();
  saveFeedback.textContent = t('saved');
  saveFeedback.style.color = '#00AB5F';
  setTimeout(() => { saveFeedback.textContent = ''; }, 2000);
});

function updateScheduleDisplay() {
  const ws = workStart.value || '09:00';
  const we = workEnd.value || '18:00';
  const bs = breakStart.value || '12:00';
  const be = breakEnd.value || '13:00';
  schedWork1.textContent = `${ws} – ${bs}`;
  schedBreak.textContent = `${bs} – ${be}`;
  schedWork2.textContent = `${be} – ${we}`;
}

// --- Stop / Busy state ---
let isFilling = false;

function setBusy(busy) {
  isFilling = busy;
  clearBtn.disabled = busy;
  spinner.style.display = busy ? 'inline' : 'none';
  if (busy) {
    fillBtn.style.background = '#e74c3c';
    fillBtn.style.color = '#fff';
    btnLabel.textContent = t('stopBtn');
    fillBtn.title = 'Click to stop';
  } else {
    fillBtn.style.background = '';
    fillBtn.style.color = '';
    btnLabel.textContent = t('fillBtn');
    fillBtn.title = '';
  }
}

function log(msg, type = 'info') {
  const line = document.createElement('div');
  line.className = `status-${type}`;
  line.textContent = msg;
  statusEl.appendChild(line);
  statusEl.scrollTop = statusEl.scrollHeight;
}

function clearLog() {
  statusEl.innerHTML = '';
}

async function sendToContent(action, payload = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error(t('noTab'));
  const response = await chrome.tabs.sendMessage(tab.id, { action, ...payload });
  return response;
}

fillBtn.addEventListener('click', async () => {
  // If currently filling, send stop signal instead
  if (isFilling) {
    try {
      await sendToContent('STOP_AUTOFILL');
      log('⏹️ Stop signal sent', 'info');
    } catch (err) {
      log('Error sending stop: ' + err.message, 'error');
    }
    return;
  }

  clearLog();
  log(t('fillLogStart'), 'info');
  setBusy(true);

  try {
    // Pass current settings to content script
    const settings = await chrome.storage.sync.get({
      workStart: '09:00',
      workEnd: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    });
    const result = await sendToContent('AUTOFILL', settings);
    if (result?.ok) {
      log(result.summary || t('summaryFmt', result.filled || 0), result.stopped ? 'info' : 'ok');
      if (result.total > 0) {
        sumFilled.textContent = result.filled || 0;
        sumSkipped.textContent = result.skipped || 0;
        sumTotal.textContent = result.total || 0;
        summaryEl.style.display = 'grid';
      }
      if (result.logs) {
        result.logs.forEach(l => {
          if (l.startsWith('✅')) log(l, 'ok');
          else if (l.startsWith('❌') || l.startsWith('⏹️')) log(l, 'error');
          else if (l.startsWith('⏭️') || l.startsWith('ℹ️') || l.startsWith('⚠️')) log(l, 'info');
          else log(l, 'info');
        });
      }
    } else {
      summaryEl.style.display = 'none';
      log(result?.error || 'Error during autofill', 'error');
    }
  } catch (err) {
    summaryEl.style.display = 'none';
    if (err.message.includes('Could not establish connection')) {
      log(t('connectionErr'), 'error');
    } else {
      log(`Error: ${err.message}`, 'error');
    }
  } finally {
    setBusy(false);
  }
});

clearBtn.addEventListener('click', async () => {
  clearLog();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.reload(tab.id);
  } catch (err) {
    log(`Error: ${err.message}`, 'error');
  }
});

// Init
loadSettings();
