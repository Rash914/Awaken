// Dev tool: run JS inside the app's Android WebView over Chrome DevTools Protocol.
// Prereq: adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
// Usage: node scripts/device-check.mjs "<expression>"
const expr = process.argv[2] || 'document.title';
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no WebView page found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
const msg = await new Promise((r) => ws.addEventListener('message', (e) => r(JSON.parse(e.data)), { once: true }));
console.log(JSON.stringify(msg.result?.result?.value ?? msg.result ?? msg, null, 1));
ws.close();
