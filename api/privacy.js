module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Allow', 'GET')
    return res.end('Method not allowed')
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PassGen Privacy Policy</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background: #f6f4fb;
        color: #1f1b2e;
      }
      .page {
        max-width: 820px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e7e2f4;
        box-shadow: 0 12px 30px rgba(96, 75, 148, 0.08);
        padding: 28px 32px 34px;
      }
      h1 { margin: 0 0 8px; font-size: 26px; color: #5a3cc3; }
      h2 { margin: 24px 0 8px; font-size: 18px; color: #3b2a77; }
      p { margin: 8px 0; line-height: 1.6; }
      ul { margin: 8px 0 0 20px; }
      .muted { color: #5b546b; font-size: 13px; }
      a { color: #5a3cc3; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main class="page">
      <h1>PassGen Privacy Policy</h1>
      <p class="muted">Last updated: 2026-01-11</p>
      <p>
        PassGen is a zero-knowledge password vault. Your vault contents and master
        password never leave your device in plaintext.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>Email address (for licensing and support, if you provide it).</li>
        <li>Install ID / device identifier (for license activation).</li>
        <li>Plan and subscription status.</li>
        <li>Basic connection metadata (IP address, timestamps) when you call our APIs.</li>
      </ul>

      <h2>Data we do not collect</h2>
      <ul>
        <li>Your master password.</li>
        <li>Vault contents in plaintext.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        If you choose to use cloud sync or online licensing, we rely on trusted
        providers to deliver those services (for example, Google, Supabase, Vercel,
        or email delivery services). These providers process only the minimum
        necessary data to complete the requested action.
      </p>

      <h2>Payments</h2>
      <p>
        Payments are processed by our payment providers. We do not store full payment
        card details on our servers.
      </p>

      <h2>Contact</h2>
      <p>
        For support or privacy questions, visit
        <a href="https://github.com/mDeploys/PassGen/issues">GitHub Issues</a>.
      </p>
    </main>
  </body>
</html>`)
}
