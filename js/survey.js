/**
 * survey.js — Markdown parser, form renderer, and local-server sender
 *
 * ── Markdown Template Rules ──────────────────────────────────
 *  # Title                    → survey page title
 *  ## N. Section Name         → section / group of questions
 *  Paragraph text under ##    → informational note shown in the section
 *  (grouped-checkboxes)       → after ##, makes the whole section a set of checkbox sub-groups
 *
 *  ### Question text          → a question (or sub-group title when inside grouped-checkboxes)
 *  * Option                   → radio button option (default when no annotation)
 *  * Option | tooltip note    → option with a hover tooltip
 *  (checkboxes)               → add before list items to make them checkboxes
 *  (short-answer)             → single-line text input
 *  (paragraph) / (long-answer)→ multi-line textarea
 *  ---                        → horizontal rules are ignored
 * ─────────────────────────────────────────────────────────────
 */

// Front Matter Parser
function parseFrontMatter(markdown) {
    const meta = {};
    const trimmed = markdown.trimStart();
    if (!trimmed.startsWith('---')) return { meta, body: markdown };

    const end = trimmed.indexOf('\n---', 3);
    if (end === -1) return { meta, body: markdown };

    const block = trimmed.slice(3, end).trim();
    block.split('\n').forEach(line => {
        const colon = line.indexOf(':');
        if (colon === -1) return;
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (key) meta[key] = value;
    });

    const body = trimmed.slice(end + 4).trimStart();
    return { meta, body };
}

// ── Markdown Parser ──────────────────────────────────────────────
function parseSurvey(markdown) {
    const { meta, body } = parseFrontMatter(markdown);
    const lines = body.split('\n').map(l => l.trimEnd());
    const survey = { title: '', meta, sections: [] };
    let currentSection = null;
    let currentQuestion = null;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();

        if (!line || line === '---') continue;

        // Survey title
        if (/^# (?!#)/.test(line)) {
            survey.title = line.slice(2).trim();

            // Section heading
        } else if (/^## (?!#)/.test(line)) {
            currentSection = {
                id: `s${survey.sections.length + 1}`,
                title: line.replace(/^##\s+\d+\.\s*/, '').trim(),
                note: '',
                questions: [],
                type: 'regular',
            };
            survey.sections.push(currentSection);
            currentQuestion = null;

            // Grouped-checkbox section annotation
        } else if (line === '(grouped-checkboxes)' && currentSection) {
            currentSection.type = 'grouped-checkboxes';

            // Question / sub-group heading
        } else if (/^### (?!#)/.test(line) && currentSection) {
            const label = line.slice(4).trim();

            if (currentSection.type === 'grouped-checkboxes') {
                // Each ### is a named checkbox group
                currentQuestion = {
                    id: `${currentSection.id}_g${currentSection.questions.length}`,
                    type: 'checkbox-group',
                    label,
                    options: [],
                };
            } else {
                // Each ### is an individual question (radio by default)
                currentQuestion = {
                    id: `${currentSection.id}_q${currentSection.questions.length}`,
                    type: 'radio',
                    label,
                    options: [],
                };
            }
            currentSection.questions.push(currentQuestion);

            // Type annotations
        } else if (line === '(short-answer)' && currentQuestion) {
            currentQuestion.type = 'short-answer';
        } else if ((line === '(paragraph)' || line === '(long-answer)') && currentQuestion) {
            currentQuestion.type = 'paragraph';
        } else if (line === '(checkboxes)' && currentQuestion) {
            currentQuestion.type = 'checkboxes';

            // List item → option
        } else if (/^[*-] /.test(line) && currentQuestion) {
            const raw = line.slice(2).trim();
            const pipeIdx = raw.indexOf(' | ');
            if (pipeIdx !== -1) {
                currentQuestion.options.push({
                    text: raw.slice(0, pipeIdx).trim(),
                    tooltip: raw.slice(pipeIdx + 3).trim(),
                });
            } else {
                currentQuestion.options.push({ text: raw, tooltip: '' });
            }

            // Plain paragraph text under a section (before any ###) → section note
        } else if (line && currentSection && !currentQuestion && !/^\(/.test(line)) {
            currentSection.note = currentSection.note
                ? currentSection.note + ' ' + line
                : line;
        }
    }

    return survey;
}

// Inline Markdown Renderer (bold, italic, code)
function renderInline(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

// Form Renderer
function renderSurvey(survey) {
    const container = document.getElementById('survey-form');
    container.innerHTML = '';

    survey.sections.forEach((section, sIdx) => {
        const card = document.createElement('div');
        card.className = 'section-card';

        // Header
        card.innerHTML = `
      <div class="section-header">
        <span class="section-number">${sIdx + 1}</span>
        <h2 class="section-title">${section.title}</h2>
      </div>
      ${section.note ? `<p class="section-note">${renderInline(section.note)}</p>` : ''}
    `;

        // Grouped checkboxes
        if (section.type === 'grouped-checkboxes') {
            const groupsWrap = document.createElement('div');
            groupsWrap.className = 'checkbox-groups';

            section.questions.forEach(q => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'checkbox-group';

                const title = document.createElement('h3');
                title.className = 'checkbox-group-title';
                title.textContent = '📍 ' + q.label;
                groupDiv.appendChild(title);

                const optionsDiv = document.createElement('div');
                optionsDiv.className = 'checkbox-options';

                q.options.forEach((opt, oIdx) => {
                    const inputId = `${q.id}_${oIdx}`;
                    const lbl = document.createElement('label');
                    lbl.className = 'checkbox-label';
                    lbl.setAttribute('for', inputId);
                    const tooltipHtml = opt.tooltip
                        ? `<span class="option-tooltip" aria-label="${escapeAttr(opt.tooltip)}">ⓘ<span class="option-tooltip-text">${opt.tooltip}</span></span>`
                        : '';
                    lbl.innerHTML = `
            <input type="checkbox" id="${inputId}" name="${q.id}" value="${escapeAttr(opt.text)}" class="checkbox-input" />
            <span class="checkbox-custom"></span>
            <span class="checkbox-text">${opt.text}</span>${tooltipHtml}
          `;
                    optionsDiv.appendChild(lbl);
                });

                groupDiv.appendChild(optionsDiv);
                groupsWrap.appendChild(groupDiv);
            });

            card.appendChild(groupsWrap);

            // ── Regular questions ──
        } else {
            section.questions.forEach(q => {
                const qDiv = document.createElement('div');
                qDiv.className = 'question';
                qDiv.innerHTML = `<label class="question-label">${renderInline(q.label)}</label>`;

                if (q.type === 'short-answer') {
                    const inp = document.createElement('input');
                    inp.type = 'text';
                    inp.name = q.id;
                    inp.className = 'text-input';
                    inp.placeholder = 'Your answer…';
                    inp.autocomplete = 'off';
                    qDiv.appendChild(inp);

                } else if (q.type === 'paragraph') {
                    const ta = document.createElement('textarea');
                    ta.name = q.id;
                    ta.className = 'textarea-input';
                    ta.placeholder = 'Your answer…';
                    ta.rows = 4;
                    qDiv.appendChild(ta);

                } else if (q.type === 'radio') {
                    const optsDiv = document.createElement('div');
                    optsDiv.className = 'radio-options';
                    q.options.forEach((opt, oIdx) => {
                        const inputId = `${q.id}_${oIdx}`;
                        const lbl = document.createElement('label');
                        lbl.className = 'radio-label';
                        lbl.setAttribute('for', inputId);
                        const tooltipHtml = opt.tooltip
                            ? `<span class="option-tooltip" aria-label="${escapeAttr(opt.tooltip)}">ⓘ<span class="option-tooltip-text">${opt.tooltip}</span></span>`
                            : '';
                        lbl.innerHTML = `
              <input type="radio" id="${inputId}" name="${q.id}" value="${escapeAttr(opt.text)}" class="radio-input" />
              <span class="radio-custom"></span>
              <span class="radio-text">${opt.text}</span>${tooltipHtml}
            `;
                        optsDiv.appendChild(lbl);
                    });
                    qDiv.appendChild(optsDiv);

                } else if (q.type === 'checkboxes') {
                    const optsDiv = document.createElement('div');
                    optsDiv.className = 'checkbox-options';
                    q.options.forEach((opt, oIdx) => {
                        const inputId = `${q.id}_${oIdx}`;
                        const lbl = document.createElement('label');
                        lbl.className = 'checkbox-label';
                        lbl.setAttribute('for', inputId);
                        const tooltipHtml = opt.tooltip
                            ? `<span class="option-tooltip" aria-label="${escapeAttr(opt.tooltip)}">ⓘ<span class="option-tooltip-text">${opt.tooltip}</span></span>`
                            : '';
                        lbl.innerHTML = `
              <input type="checkbox" id="${inputId}" name="${q.id}" value="${escapeAttr(opt.text)}" class="checkbox-input" />
              <span class="checkbox-custom"></span>
              <span class="checkbox-text">${opt.text}</span>${tooltipHtml}
            `;
                        optsDiv.appendChild(lbl);
                    });
                    qDiv.appendChild(optsDiv);
                }

                card.appendChild(qDiv);
            });
        }

        container.appendChild(card);
    });

    document.getElementById('submit-btn').disabled = false;
}

// Collect Answers
function collectAnswers(survey) {
    const data = {};
    const respondent = document.getElementById('respondent-name').value.trim() || 'Anonymous';
    data['__name__'] = respondent;

    survey.sections.forEach(section => {
        const prefix = section.title;

        if (section.type === 'grouped-checkboxes') {
            section.questions.forEach(q => {
                const checked = [...document.querySelectorAll(`input[name="${q.id}"]:checked`)]
                    .map(el => el.value);
                if (checked.length) {
                    data[`[${prefix}] ${q.label}`] = checked.join(', ');
                }
            });
        } else {
            section.questions.forEach(q => {
                if (q.type === 'radio') {
                    const el = document.querySelector(`input[name="${q.id}"]:checked`);
                    if (el) data[`[${prefix}] ${q.label}`] = el.value;
                } else if (q.type === 'checkboxes') {
                    const checked = [...document.querySelectorAll(`input[name="${q.id}"]:checked`)]
                        .map(el => el.value);
                    if (checked.length) data[`[${prefix}] ${q.label}`] = checked.join(', ');
                } else {
                    const el = document.querySelector(`[name="${q.id}"]`);
                    if (el && el.value.trim()) data[`[${prefix}] ${q.label}`] = el.value.trim();
                }
            });
        }
    });

    return data;
}

// Format Email Body (HTML)
function formatEmailBody(answers, surveyTitle) {
    const name = answers['__name__'];
    let html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#333">
      <h1 style="color:#e74c3c;font-size:1.6rem">🌏 ${surveyTitle}</h1>
      <p style="color:#666">Response from: <strong>${name}</strong></p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
  `;

    let lastSection = '';
    Object.entries(answers).forEach(([key, val]) => {
        if (key === '__name__') return;

        // Extract section name from key like "[Section] Question"
        const sectionMatch = key.match(/^\[(.+?)\]\s*/);
        const sectionName = sectionMatch ? sectionMatch[1] : '';
        const questionText = sectionMatch ? key.slice(sectionMatch[0].length) : key;

        if (sectionName !== lastSection) {
            html += `<h2 style="font-size:1.05rem;color:#c0392b;margin-top:24px;margin-bottom:8px;border-left:4px solid #e74c3c;padding-left:10px">${sectionName}</h2>`;
            lastSection = sectionName;
        }

        html += `
      <div style="margin-bottom:12px;padding:10px 14px;background:#fafafa;border-radius:8px">
        <p style="font-weight:700;margin:0 0 4px;font-size:.9rem">${questionText}</p>
        <p style="margin:0;color:#555;font-size:.9rem">${val.replace(/\n/g, '<br/>')}</p>
      </div>
    `;
    });

    html += '</div>';
    return html;
}

// Utility
function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Apply Front Matter Meta to DOM
function applyMeta(meta) {
    const set = (id, val, attr = 'textContent') => {
        const el = document.getElementById(id);
        if (el && val !== undefined) {
            if (attr === 'innerHTML') el.innerHTML = val;
            else el.textContent = val;
        }
    };
    const setAttr = (id, attr, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.setAttribute(attr, val);
    };

    if (meta['page-title']) document.title = meta['page-title'];
    set('hero-flag', meta['flag']);
    set('hero-title', meta['hero-title']);
    set('hero-subtitle', meta['hero-subtitle']);
    set('hero-deco-left', meta['hero-deco-left']);
    set('hero-deco-right', meta['hero-deco-right']);
    set('name-label-text', meta['name-label']);
    setAttr('respondent-name', 'placeholder', meta['name-placeholder']);
    set('submit-icon', meta['submit-icon']);
    set('submit-hint', meta['submit-hint']);
    set('modal-emoji', meta['modal-emoji']);
    set('modal-title', meta['modal-title']);
    set('modal-body', meta['modal-body'], 'innerHTML');
    set('modal-button', meta['modal-button']);
}

// Load Survey from Markdown File
let surveyData = null;

async function loadSurvey() {
    try {
        const res = await fetch('survey.md');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const markdown = await res.text();
        surveyData = parseSurvey(markdown);
        applyMeta(surveyData.meta);
        renderSurvey(surveyData);
    } catch (err) {
        document.getElementById('survey-form').innerHTML = `
      <div class="error-message">
        <p>⚠️ Could not load <strong>survey.md</strong>.</p>
        <p>This page must be served from a local server (not opened as a file).</p>
        <br/>
        <p>Run one of these in the survey folder:</p>
        <p><code>python3 server.py</code></p>
        <p>then open <code>http://localhost:8080</code></p>
      </div>
    `;
    }
}

// Submit Handler
document.getElementById('submit-btn').addEventListener('click', async () => {
    if (!surveyData) return;

    const answers = collectAnswers(surveyData);
    const btn = document.getElementById('submit-btn');

    btn.disabled = true;
    btn.querySelector('.submit-label').textContent = 'Saving…';

    try {
        const res = await fetch('/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(answers),
        });

        if (!res.ok) throw new Error(`Server responded with ${res.status}`);

        // Clear all inputs
        document.getElementById('respondent-name').value = '';
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => el.checked = false);
        document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');

        document.getElementById('success-modal').classList.remove('hidden');
        btn.querySelector('.submit-label').textContent = '✅ Submitted!';
        setTimeout(() => {
            btn.disabled = false;
            btn.querySelector('.submit-label').textContent = 'Submit My Answers!';
        }, 3000);
    } catch (err) {
        console.error('Submit error:', err);
        alert('Oops! Could not save your answers. Make sure the Python server is running.');
        btn.disabled = false;
        btn.querySelector('.submit-label').textContent = 'Submit My Answers!';
    }
});

// Modal Close
function closeModal() {
    document.getElementById('success-modal').classList.add('hidden');
}

// Init
loadSurvey();
