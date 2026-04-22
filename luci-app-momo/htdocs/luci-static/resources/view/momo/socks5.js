'use strict';
'require form';
'require view';
'require tools.momo-socks5 as socks5';

/*
 * SOCKS5 Quick Profile page
 * ─────────────────────────
 * Lets users type  user:pass@host:port  and save it as a sing-box
 * JSON profile without manually uploading a file.
 *
 * All code lives in brand-new files so upstream momo upgrades never
 * cause conflicts.
 */

/* ── helpers ─────────────────────────────────────────────────── */

function showMsg(el, ok, text) {
    el.className = 'socks5-msg ' + (ok ? 'socks5-msg--ok' : 'socks5-msg--err');
    el.textContent = text;
    el.style.display = 'block';
}

function hideMsg(el) {
    el.style.display = 'none';
}

/* ── inline CSS injected once ────────────────────────────────── */

function injectStyles() {
    if (document.getElementById('socks5-style')) return;
    const style = document.createElement('style');
    style.id = 'socks5-style';
    style.textContent = `
        .socks5-card {
            background: var(--background-color-medium, #f5f5f5);
            border: 1px solid var(--border-color, #ccc);
            border-radius: 6px;
            padding: 1.2em 1.5em 1.5em;
            margin-bottom: 1.5em;
        }
        .socks5-card h3 {
            margin: 0 0 1em;
            font-size: 1em;
            font-weight: bold;
        }
        .socks5-row {
            display: flex;
            flex-wrap: wrap;
            gap: .6em;
            align-items: flex-end;
        }
        .socks5-field {
            display: flex;
            flex-direction: column;
            gap: .3em;
        }
        .socks5-field label {
            font-size: .85em;
            font-weight: bold;
            white-space: nowrap;
        }
        .socks5-field input[type=text] {
            padding: .35em .5em;
            border: 1px solid var(--border-color, #ccc);
            border-radius: 4px;
            font-size: .9em;
            min-width: 220px;
        }
        .socks5-field input[type=text].socks5-input--error {
            border-color: #c00;
        }
        .socks5-btn {
            padding: .4em 1.1em;
            border: none;
            border-radius: 4px;
            background: #2ea44f;
            color: #fff;
            font-size: .9em;
            cursor: pointer;
            white-space: nowrap;
            align-self: flex-end;
        }
        .socks5-btn:hover  { background: #22863a; }
        .socks5-btn:active { background: #155724; }
        .socks5-btn:disabled { background: #999; cursor: not-allowed; }
        .socks5-msg {
            margin-top: .7em;
            padding: .4em .8em;
            border-radius: 4px;
            font-size: .85em;
            display: none;
        }
        .socks5-msg--ok  { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .socks5-msg--err { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .socks5-hint {
            margin-top: .5em;
            font-size: .8em;
            color: var(--text-color-low, #777);
        }
    `;
    document.head.appendChild(style);
}

/* ── credential format validator (mirrors backend logic) ─────── */

function validateCredentials(raw) {
    const str = (raw || '').trim();
    if (!str) return 'Credentials are required';

    const atIdx = str.lastIndexOf('@');
    if (atIdx < 0) return 'Missing "@" separator';

    const auth = str.substring(0, atIdx);
    const hostPort = str.substring(atIdx + 1);

    const cIdx = auth.indexOf(':');
    if (cIdx < 0) return 'Missing ":" between username and password';
    if (!auth.substring(0, cIdx)) return 'Username is empty';
    if (!auth.substring(cIdx + 1)) return 'Password is empty';

    let portStr;
    if (hostPort.startsWith('[')) {
        const be = hostPort.indexOf(']');
        if (be < 0) return 'Unterminated "[" in IPv6 address';
        const rest = hostPort.substring(be + 1);
        if (!rest.startsWith(':')) return 'Missing port after IPv6 address';
        portStr = rest.substring(1);
    } else {
        const lc = hostPort.lastIndexOf(':');
        if (lc < 0) return 'Missing port in host:port';
        const host = hostPort.substring(0, lc);
        if (!host) return 'Host is empty';
        portStr = hostPort.substring(lc + 1);
    }

    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535)
        return 'Port must be 1–65535';

    return null; // valid
}

function validateName(raw) {
    const str = (raw || '').trim();
    if (!str) return 'Filename is required';
    if (/[/\\]/.test(str)) return 'Filename must not contain path separators';
    if (!str.endsWith('.json')) return 'Filename must end with .json';
    return null;
}

/* ── view ────────────────────────────────────────────────────── */

return view.extend({

    load: function() {
        return Promise.resolve();
    },

    render: function() {
        injectStyles();

        /* ── wrapper ── */
        const view = E('div', { class: 'cbi-map' }, [
            E('h2', {}, _('SOCKS5 Quick Profile')),
            E('div', { class: 'cbi-map-descr' },
                _('Enter SOCKS5 credentials to generate a sing-box profile file. ' +
                  'The file is saved into the profiles directory and can be selected ' +
                  'immediately in App Config → Choose Profile.')
            )
        ]);

        /* ── card ── */
        const card = E('div', { class: 'socks5-card' });
        card.appendChild(E('h3', {}, _('Create from SOCKS5 Credentials')));

        /* ── fields row ── */
        const row = E('div', { class: 'socks5-row' });

        /* credentials input */
        const credInput = E('input', {
            id: 'socks5-credentials',
            type: 'text',
            placeholder: 'user:pass@34.123.25.102:23416',
            autocomplete: 'off',
            spellcheck: 'false',
            style: 'width:320px'
        });
        const credField = E('div', { class: 'socks5-field' }, [
            E('label', { for: 'socks5-credentials' }, _('Credentials')),
            credInput
        ]);

        /* filename input */
        const nameInput = E('input', {
            id: 'socks5-filename',
            type: 'text',
            placeholder: 'my-proxy.json',
            autocomplete: 'off',
            spellcheck: 'false',
            style: 'width:180px'
        });
        const nameField = E('div', { class: 'socks5-field' }, [
            E('label', { for: 'socks5-filename' }, _('Filename')),
            nameInput
        ]);

        /* submit button */
        const btn = E('button', {
            class: 'socks5-btn',
            id: 'socks5-create-btn'
        }, _('Create Profile'));

        row.appendChild(credField);
        row.appendChild(nameField);
        row.appendChild(btn);
        card.appendChild(row);

        /* hint */
        card.appendChild(E('div', { class: 'socks5-hint' },
            _('Format: user:pass@host:port  •  Example: betty:prgrno1@34.123.25.102:23416')
        ));

        /* message area */
        const msg = E('div', { class: 'socks5-msg', id: 'socks5-msg' });
        card.appendChild(msg);

        view.appendChild(card);

        /* ── live validation on input ── */
        credInput.addEventListener('input', function() {
            hideMsg(msg);
            const err = validateCredentials(this.value);
            this.classList.toggle('socks5-input--error', !!err && this.value.length > 0);
        });

        nameInput.addEventListener('input', function() {
            hideMsg(msg);
            const err = validateName(this.value);
            this.classList.toggle('socks5-input--error', !!err && this.value.length > 0);
        });

        /* ── submit handler ── */
        btn.addEventListener('click', function() {
            hideMsg(msg);

            const rawCred = credInput.value.trim();
            const rawName = nameInput.value.trim();

            /* client-side validation first */
            const credErr = validateCredentials(rawCred);
            if (credErr) {
                credInput.classList.add('socks5-input--error');
                showMsg(msg, false, credErr);
                credInput.focus();
                return;
            }

            const nameErr = validateName(rawName);
            if (nameErr) {
                nameInput.classList.add('socks5-input--error');
                showMsg(msg, false, nameErr);
                nameInput.focus();
                return;
            }

            /* call backend */
            btn.disabled = true;
            btn.textContent = _('Creating…');

            socks5.createSocks5Profile(rawName, rawCred).then(function(res) {
                if (res && res.success) {
                    credInput.value = '';
                    nameInput.value = '';
                    credInput.classList.remove('socks5-input--error');
                    nameInput.classList.remove('socks5-input--error');
                    showMsg(msg, true,
                        _('Profile created: ') + (res.path || rawName) +
                        _(' — you can now select it in App Config → Choose Profile.')
                    );
                } else {
                    showMsg(msg, false,
                        _('Error: ') + (res?.error || _('Unknown error from backend'))
                    );
                }
            }).catch(function(err) {
                showMsg(msg, false, _('RPC call failed: ') + String(err));
            }).finally(function() {
                btn.disabled = false;
                btn.textContent = _('Create Profile');
            });
        });

        return view;
    },

    handleSave:   null,
    handleSaveApply: null,
    handleReset:  null
});
