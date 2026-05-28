(function () {
  'use strict';

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function fireKey(target, type, key) {
    const code = key.length === 1 ? 'Digit' + key : key;
    target.dispatchEvent(new KeyboardEvent(type, {
      key, code, bubbles: true, cancelable: true
    }));
  }

  function click(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  }

  // --- Parse day from live Personio DOM ---
  function parseDayRow(rowEl) {
    const dateGrid = rowEl.querySelector('[class*="DayCell"] [class*="dateGrid"]');
    if (!dateGrid) return null;
    const timeEl = dateGrid.querySelector('time');
    if (!timeEl) return null;
    const dateStr = timeEl.getAttribute('datetime');
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return { id: dateStr, dayNumber: date.getDate(), rowEl, date, isWeekend, dayOfWeek };
  }

  function getTrackedHours(rowEl) {
    const area = rowEl.querySelector('[data-test-id="tracked-vs-target-area"]');
    if (!area) return null;
    const text = (area.textContent || '').replace(/\s+/g, ' ').trim();
    const m = text.match(/(\d+)h\s*\/\s*(\d+)h/);
    return m ? { current: parseInt(m[1]), expected: parseInt(m[2]) } : null;
  }

  // --- Set React contenteditable spinbutton value (Zogoo's proven approach) ---
  function setNativeValue(target, value) {
    if ('value' in target) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        || Object.getOwnPropertyDescriptor(target.constructor.prototype, 'value');
      if (descriptor?.set) descriptor.set.call(target, value);
      else target.value = value;
      return;
    }
    if (target.isContentEditable) {
      target.textContent = String(value);
      return;
    }
    target.textContent = String(value);
  }

  async function writeFieldValue(field, value, logger) {
    const text = String(value).padStart(2, '0').slice(-2);

    field.scrollIntoView({ block: 'nearest' });
    await sleep(50);
    field.focus();

    // Strategy 1: execCommand('insertText') — React captures this natively
    fireKey(field, 'keydown', 'a');
    fireKey(field, 'keyup', 'a');
    await sleep(20);
    fireKey(field, 'keydown', 'Backspace');
    fireKey(field, 'keyup', 'Backspace');
    await sleep(30);

    let didPaste = false;
    try {
      didPaste = document.execCommand('insertText', false, text);
    } catch (_e) { /* ignore */ }

    if (didPaste) {
      field.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: text
      }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Strategy 2: Set via native value descriptor + events
      setNativeValue(field, text);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    fireKey(field, 'keydown', 'Tab');
    fireKey(field, 'keyup', 'Tab');
    field.blur();
    await sleep(80);
  }

  async function fillSpinField(container, hourOrMinute, type, logger) {
    const spins = container.querySelectorAll('[role="spinbutton"]');
    if (!spins.length) { logger?.push(`  Keine Spinbuttons in ${type}`); return; }
    const idx = type === 'hours' ? 0 : 1;
    const spin = spins[idx];
    if (!spin) return;
    await writeFieldValue(spin, hourOrMinute);
  }

  async function fillTimeGroup(periodContainer, hour, minute, label, logger) {
    const h = pad2(hour);
    const m = pad2(minute);
    logger?.push(`  ${label}: ${h}:${m}`);
    await fillSpinField(periodContainer, h, 'hours', logger);
    await fillSpinField(periodContainer, m, 'minutes', logger);

    // Sync hidden input
    const hidden = periodContainer.querySelector('input[type="time"]');
    if (hidden) {
      const fullTime = h + ':' + m;
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc?.set) {
        desc.set.call(hidden, fullTime);
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  // --- Open day editor ---
  async function openDayEditor(rowEl, logger) {
    let form = rowEl.querySelector('[data-test-id="time-entry-form"]');
    if (form) return form;

    logger?.push(`  Öffne Editor...`);
    rowEl.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(200);

    const dateCell = rowEl.querySelector('[role="gridcell"]');
    if (dateCell) { click(dateCell); await sleep(500); }

    form = rowEl.querySelector('[data-test-id="time-entry-form"]');
    if (form) return form;

    const optionsBtn = rowEl.querySelector('[data-action-name="timesheet-day-options-button"]');
    if (optionsBtn) {
      click(optionsBtn);
      await sleep(400);
      const items = document.querySelectorAll('[role="menuitem"]');
      for (const item of items) {
        const txt = (item.textContent || '').replace(/\s+/g, ' ').trim();
        if (/(0h\s*(tag|day)|track)/i.test(txt)) {
          click(item);
          await sleep(500);
          break;
        }
      }
    }

    return rowEl.querySelector('[data-test-id="time-entry-form"]');
  }

  // --- Ensure period type via combobox ---
  async function ensurePeriodType(entryRowEl, expectedType, logger) {
    const combo = entryRowEl.querySelector('button[role="combobox"]');
    if (!combo) return false;
    const currentText = (combo.textContent || '').replace(/\s+/g, ' ').trim();
    if (new RegExp('\\b' + expectedType + '\\b', 'i').test(currentText)) return true;

    click(combo);
    await sleep(350);

    const listboxId = combo.getAttribute('aria-controls');
    let opts = [];
    if (listboxId) {
      const lb = document.getElementById(listboxId);
      if (lb) opts = Array.from(lb.querySelectorAll('[role="option"]'));
    }
    if (!opts.length) opts = Array.from(document.querySelectorAll('[role="option"]'));

    const aliases = expectedType === 'Pause'
      ? ['pause', 'break', 'ruhepause', 'rest']
      : ['arbeit', 'work'];
    const target = opts.find(o =>
      aliases.some(a => new RegExp('\\b' + a + '\\b', 'i').test((o.textContent || '').replace(/\s+/g, ' ').trim()))
    );
    if (target) { click(target); await sleep(200); return true; }
    return false;
  }

  // --- In-page feedback overlay ---
  let feedbackOverlay = null;

  function showFeedback(text, type) {
    hideFeedback();
    const overlay = document.createElement('div');
    overlay.id = 'personio-autofill-feedback';
    overlay.style.cssText = [
      'position:fixed;top:16px;right:16px;z-index:2147483647;',
      'padding:12px 20px;border-radius:8px;font:14px/1.5 sans-serif;',
      'box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:360px;',
      'pointer-events:none;transition:opacity 0.3s ease;',
      type === 'error' ? 'background:#e74c3c;color:#fff;' : 'background:#00AB5F;color:#fff;'
    ].join('');
    overlay.textContent = text;
    document.body.appendChild(overlay);
    feedbackOverlay = overlay;
    setTimeout(() => {
      if (feedbackOverlay) {
        feedbackOverlay.style.opacity = '0';
        setTimeout(hideFeedback, 500);
      }
    }, 4000);
  }

  function hideFeedback() {
    if (feedbackOverlay) {
      feedbackOverlay.remove();
      feedbackOverlay = null;
    }
  }

  // --- Dismiss "Review time entries" modal ---
  function dismissReviewModal() {
    const candidates = document.querySelectorAll('[role="dialog"], [aria-modal="true"]');
    for (const modal of candidates) {
      if (/review time entries/i.test((modal.textContent || '').replace(/\s+/g, ' ').trim())) {
        const btns = modal.querySelectorAll('button');
        for (const btn of btns) {
          const label = (btn.textContent || '').trim();
          if (/^(edit|bearbeiten)$/i.test(label)) { click(btn); return true; }
        }
        // Escape fallback
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // --- Add third period row ---
  async function ensureThirdWorkRow(form, logger) {
    let rows = form.querySelectorAll('[data-test-id="timeEntryRow"]');
    if (rows.length >= 3) return rows;

    const addWork = form.querySelector('[data-test-id="timecard-add-work"]');
    if (!addWork) { logger?.push(`  ⚠️ Kein "Arbeit hinzufügen" Button`); return rows; }

    const before = rows.length;
    click(addWork);
    logger?.push(`  + Arbeit hinzugefügt (3. Block)`);
    await sleep(500);

    rows = form.querySelectorAll('[data-test-id="timeEntryRow"]');
    return rows;
  }

  function parseTime(str) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(str));
    if (!m) return null;
    return { h: parseInt(m[1]), m: parseInt(m[2]) };
  }

  // --- Fill a single day ---
  async function fillSingleDay(day, times, logger) {
    const rowEl = day.rowEl;
    const { ws, bs, be, we } = times;

    dismissReviewModal();

    const form = await openDayEditor(rowEl, logger);
    if (!form) { logger?.push(`  ❌ Editor not found`); return false; }
    await sleep(200);

    // --- Period 0: Work ws → bs ---
    const p0s = form.querySelector('[data-test-id="periods.0.start"]');
    const p0e = form.querySelector('[data-test-id="periods.0.end"]');
    if (p0s && p0e) {
      await fillTimeGroup(p0s, ws.h, ws.m, 'Work start', logger);
      await fillTimeGroup(p0e, bs.h, bs.m, 'Work end', logger);
    }
    await sleep(80);

    // --- Period 1: Break bs → be ---
    let p1s = form.querySelector('[data-test-id="periods.1.start"]');
    let p1e = form.querySelector('[data-test-id="periods.1.end"]');

    if (p1s && p1e) {
      await fillTimeGroup(p1s, bs.h, bs.m, 'Break start', logger);
      await fillTimeGroup(p1e, be.h, be.m, 'Break end', logger);
    } else {
      logger?.push(`  No break block, adding...`);
      const addBreak = form.querySelector('[data-test-id="timecard-add-break"]');
      if (addBreak) {
        click(addBreak);
        await sleep(500);
        p1s = form.querySelector('[data-test-id="periods.1.start"]');
        p1e = form.querySelector('[data-test-id="periods.1.end"]');
        if (p1s && p1e) {
          await fillTimeGroup(p1s, bs.h, bs.m, 'Break start', logger);
          await fillTimeGroup(p1e, be.h, be.m, 'Break end', logger);
        }
      }
    }
    await sleep(80);

    // Set Pause type on period 1
    const entryRows = form.querySelectorAll('[data-test-id="timeEntryRow"]');
    if (entryRows.length >= 2) {
      await ensurePeriodType(entryRows[1], 'Pause', logger);
    }

    // --- Add Period 2: Work be → we ---
    await ensureThirdWorkRow(form, logger);
    await sleep(300);

    const p2s = form.querySelector('[data-test-id="periods.2.start"]');
    const p2e = form.querySelector('[data-test-id="periods.2.end"]');
    if (p2s && p2e) {
      await fillTimeGroup(p2s, be.h, be.m, 'Work start', logger);
      await fillTimeGroup(p2e, we.h, we.m, 'Work end', logger);
    }

    const rowsAfter = form.querySelectorAll('[data-test-id="timeEntryRow"]');
    if (rowsAfter.length >= 3) {
      await ensurePeriodType(rowsAfter[2], 'Arbeit', logger);
    }

    // Save
    await sleep(200);
    const saveBtn = form.querySelector('[data-test-id="timecard-save-button"]');
    if (!saveBtn) { logger?.push(`  ⚠️ No save button`); return false; }

    click(saveBtn);
    logger?.push(`  💾 Saved`);
    await sleep(800);

    if (dismissReviewModal()) {
      logger?.push(`  ⚠️ Validation modal appeared — day may not be saved`);
      const cancel = form.querySelector('[data-test-id="timecard-cancel-button"]');
      if (cancel) { click(cancel); await sleep(300); }
      return false;
    }

    return true;
  }

  // --- Stop mechanism ---
  let shouldStop = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'STOP_AUTOFILL') {
      shouldStop = true;
      sendResponse({ ok: true });
      return false;
    }
    if (message.action === 'PING') {
      sendResponse({ ok: true, running: isRunning });
      return false;
    }
    if (message.action === 'AUTOFILL') {
      const settings = {
        workStart: message.workStart,
        workEnd: message.workEnd,
        breakStart: message.breakStart,
        breakEnd: message.breakEnd
      };
      autofill(settings).then(r => sendResponse(r));
      return true;
    }
  });

  // --- Main autofill ---
  let isRunning = false;

  async function autofill(settings) {
    if (isRunning) return { ok: false, error: 'Already running' };
    isRunning = true;
    shouldStop = false;

    const times = {
      ws: parseTime(settings?.workStart) || { h: 9, m: 0 },
      bs: parseTime(settings?.breakStart) || { h: 12, m: 0 },
      be: parseTime(settings?.breakEnd) || { h: 13, m: 0 },
      we: parseTime(settings?.workEnd) || { h: 18, m: 0 }
    };

    const logger = [];
    logger.push('🔍 Autofill started...');
    showFeedback('⏳ Filling days...', 'success');

    try {
      const rowEls = document.querySelectorAll('[data-test-id="timesheet-timecard"][role="row"]');
      if (!rowEls.length) {
        logger.push('❌ Keine Timesheet-Zeilen gefunden.');
        showFeedback('❌ Keine Zeilen gefunden', 'error');
        return { ok: false, error: 'Keine Zeilen', logs: logger };
      }

      const days = [];
      for (const rowEl of rowEls) {
        const parsed = parseDayRow(rowEl);
        if (parsed) days.push(parsed);
      }

      if (!days.length) {
        showFeedback('❌ Keine Datumsinformationen', 'error');
        return { ok: false, error: 'Keine Datumsinfo', logs: logger };
      }

      let filled = 0, skippedWeekend = 0, skippedFilled = 0;

      for (const day of days) {
        const dn = day.dayNumber;
        const label = (['So','Mo','Di','Mi','Do','Fr','Sa'][day.dayOfWeek] || '??') + ' ' + dn;

        if (shouldStop) {
          logger.push('⏹️  ' + label + ': stopped by user');
          break;
        }

        if (day.isWeekend) {
          logger.push('⏭️  ' + label + ': Wochenende');
          skippedWeekend++;
          continue;
        }

        // Re-find the row fresh — Personio re-renders DOM after each save
        const freshRows = document.querySelectorAll('[data-test-id="timesheet-timecard"][role="row"]');
        let rowEl = null;
        for (const r of freshRows) {
          const p = parseDayRow(r);
          if (p && p.id === day.id) { rowEl = r; break; }
        }
        if (!rowEl) {
          logger.push('⏭️  ' + label + ': Zeile nicht mehr im DOM');
          skippedFilled++;
          continue;
        }

        const isHoliday = rowEl.getAttribute('data-is-holiday') === 'true';
        const isOffDay = rowEl.getAttribute('data-is-off-day') === 'true';
        if (isHoliday || isOffDay) {
          logger.push('⏭️  ' + label + ': holiday/absence');
          skippedFilled++;
          continue;
        }

        const tracked = getTrackedHours(rowEl);
        if (tracked && tracked.current > 0) {
          logger.push('⏭️  ' + label + ': ' + tracked.current + 'h already tracked');
          skippedFilled++;
          continue;
        }

        logger.push('--- ' + label + ' ---');
        try {
          const dayObj = { id: day.id, dayNumber: dn, rowEl: rowEl };
          const ok = await fillSingleDay(dayObj, times, logger);
          if (ok) { filled++; logger.push('✅ ' + label + ' filled'); }
          else { logger.push('⚠️  ' + label + ' not filled'); }
        } catch (err) {
          logger.push('❌ ' + label + ': ' + err.message);
        }
        await sleep(300);
      }

      const total = days.length;
      const skipped = skippedWeekend + skippedFilled;
      const stopped = shouldStop ? ' ✋ stopped' : '';
      const summary = filled + '/' + total + ' days filled (' + skipped + ' skipped)' + stopped;
      logger.push('--- ' + summary + ' ---');

      if (shouldStop) showFeedback('✋ Stopped by user', 'error');
      else if (filled > 0) showFeedback('✅ ' + summary, 'success');
      else if (skipped === total) showFeedback('ℹ️ All days already tracked or weekend', 'success');
      else showFeedback('⚠️ ' + summary, 'error');

      return { ok: true, summary, filled, total, skipped, stopped: shouldStop, logs: logger };
    } catch (err) {
      showFeedback('❌ Error: ' + err.message, 'error');
      return { ok: false, error: err.message, logs: logger };
    } finally {
      isRunning = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-test-id="timesheet-timecard"][role="row"]')) {
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
