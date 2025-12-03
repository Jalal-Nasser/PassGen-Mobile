function detectLoginForm() {
  const inputs = Array.from(document.querySelectorAll('input'));
  const pass = inputs.find(i => i.type === 'password');
  if (!pass) return null;
  const form = pass.closest('form') || document;
  const user = inputs.find(i => i.type === 'email' || i.type === 'text' || i.autocomplete === 'username');
  return { form, user, pass };
}

async function getDomain() {
  try {
    const { hostname } = new URL(location.href);
    return hostname || '';
  } catch {
    return location.hostname || '';
  }
}

async function tryAutofill() {
  const dom = await getDomain();
  chrome.runtime.sendMessage({ type: 'passgen:listCandidates', domain: dom }, async (resp) => {
    if (!resp || !resp.ok) return;
    const names = resp.names || [];
    if (!names.length) return;
    const pick = names[0]; // naive pick first; later add UI picker
    chrome.runtime.sendMessage({ type: 'passgen:fillById', id: pick.id }, (r) => {
      if (!r || !r.ok) return;
      const found = detectLoginForm();
      if (!found) return;
      if (found.user) found.user.value = r.username || '';
      if (found.pass) found.pass.value = r.password || '';
    });
  });
}

// Run shortly after DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(tryAutofill, 300);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(tryAutofill, 300));
}
