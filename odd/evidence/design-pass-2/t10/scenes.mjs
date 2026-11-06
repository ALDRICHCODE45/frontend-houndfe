// Round-2 low re-check, last pass: login error (the 401 is mocked, no real attempt).
export const scenes = [
  { name: 'login-error', path: '/login', vp: [1440, 390], pre: async (p) => {
    await p.context().clearCookies()
    await p.evaluate(() => localStorage.clear())
    await p.route((u) => /\/auth\/login$/.test(u.pathname), (r) => r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': 'http://127.0.0.1:5173', 'access-control-allow-credentials': 'true' }, body: JSON.stringify({ statusCode: 401, message: 'Invalid credentials' }) }))
  }, act: async (p) => { await p.fill('#email', 'nadie@houndfe.com'); await p.fill('#password', 'contrasena-falsa-123'); await p.click('button[type=submit]'); await p.waitForTimeout(1200) } },
]
