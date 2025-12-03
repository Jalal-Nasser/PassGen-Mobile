const STATE = {
  token: null,
};

async function fetchJSON(path, opts = {}) {
  const url = `http://127.0.0.1:17865${path}`;
  const headers = Object.assign({}, opts.headers || {});
  if (STATE.token) headers['x-passgen-session'] = STATE.token;
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'passgen:setToken') {
        STATE.token = msg.token;
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'passgen:listCandidates') {
        const domain = msg.domain;
        const data = await fetchJSON(`/credentials?domain=${encodeURIComponent(domain)}`);
        sendResponse({ ok: true, names: data.names || [] });
        return;
      }
      if (msg.type === 'passgen:fillById') {
        const id = msg.id;
        const data = await fetchJSON(`/fill`, { method: 'POST', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } });
        sendResponse({ ok: true, username: data.username || '', password: data.password });
        return;
      }
      sendResponse({ ok: false, error: 'unknown_message' });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true;
});
