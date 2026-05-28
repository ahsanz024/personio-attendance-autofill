const fillBtn = document.getElementById('fillBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const btnLabel = document.getElementById('btnLabel');
const spinner = document.getElementById('spinner');
const summaryEl = document.getElementById('summary');
const sumFilled = document.getElementById('sumFilled');
const sumSkipped = document.getElementById('sumSkipped');
const sumTotal = document.getElementById('sumTotal');

function setBusy(busy) {
  fillBtn.disabled = busy;
  clearBtn.disabled = busy;
  spinner.style.display = busy ? 'inline' : 'none';
  btnLabel.textContent = busy ? 'Fülle Tage...' : '📋 Alle leeren Tage füllen';
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
  if (!tab?.id) throw new Error('Kein aktiver Tab gefunden');

  const response = await chrome.tabs.sendMessage(tab.id, { action, ...payload });
  return response;
}

fillBtn.addEventListener('click', async () => {
  clearLog();
  log('Starte Autofill...', 'info');
  setBusy(true);

  try {
    const result = await sendToContent('AUTOFILL');
    if (result?.ok) {
      log(result.summary || 'Fertig!', 'ok');

      if (result.total > 0) {
        sumFilled.textContent = result.filled || 0;
        sumSkipped.textContent = result.skipped || 0;
        sumTotal.textContent = result.total || 0;
        summaryEl.style.display = 'grid';
      }

      if (result.logs) {
        result.logs.forEach(l => {
          if (l.startsWith('✅')) log(l, 'ok');
          else if (l.startsWith('❌')) log(l, 'error');
          else if (l.startsWith('⏭️') || l.startsWith('ℹ️') || l.startsWith('⚠️')) log(l, 'info');
          else log(l, 'info');
        });
      }
    } else {
      summaryEl.style.display = 'none';
      log(result?.error || 'Fehler beim Autofill', 'error');
    }
  } catch (err) {
    summaryEl.style.display = 'none';
    if (err.message.includes('Could not establish connection')) {
      log('Keine Verbindung zur Personio-Seite. Bitte lade die Seite neu.', 'error');
    } else {
      log(`Fehler: ${err.message}`, 'error');
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
    log(`Fehler: ${err.message}`, 'error');
  }
});
