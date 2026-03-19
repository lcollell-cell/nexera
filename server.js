/**
 * DevDeploy Manager — Servidor Local con Proxy Anthropic
 * -------------------------------------------------------
 * Lee ANTHROPIC_API_KEY del entorno y la usa para llamadas a Claude.
 *
 * Uso:
 *   node server.js
 *   (o)  PORT=8090 node server.js
 *
 * Requiere:  Node.js >= 16  (sin dependencias externas)
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ── Configuración ──────────────────────────────────────────────
const PORT       = process.env.PORT || 8090;
const API_KEY    = process.env.ANTHROPIC_API_KEY || '';
const HTML_FILE  = path.join(__dirname, 'devdeploy-manager.html');

// ── Colores ANSI para la consola ───────────────────────────────
const C = {
  reset:'\x1b[0m', cyan:'\x1b[36m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', gray:'\x1b[90m', bold:'\x1b[1m'
};
const log  = (msg) => console.log(`${C.cyan}[DevDeploy]${C.reset} ${msg}`);
const ok   = (msg) => console.log(`${C.green}✓${C.reset} ${msg}`);
const warn = (msg) => console.log(`${C.yellow}⚠${C.reset}  ${msg}`);
const err  = (msg) => console.log(`${C.red}✕${C.reset} ${msg}`);

// ── Validación de API key al arrancar ─────────────────────────
if (!API_KEY) {
  warn('ANTHROPIC_API_KEY no está seteada en el entorno.');
  warn('El chatbot usará respuestas locales como fallback.');
  warn('Para activar Claude real: set ANTHROPIC_API_KEY=sk-ant-...');
} else if (!API_KEY.startsWith('sk-ant')) {
  warn('ANTHROPIC_API_KEY parece inválida (debe empezar con sk-ant-)');
} else {
  ok(`ANTHROPIC_API_KEY detectada: ${API_KEY.slice(0,12)}...${API_KEY.slice(-4)}`);
}

// ── Proxy hacia Anthropic API ──────────────────────────────────
function proxyAnthropic(reqBody, res) {
  if (!API_KEY) {
    res.writeHead(401, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({error:{type:'auth',message:'ANTHROPIC_API_KEY no configurada en el servidor.'}}));
    return;
  }

  const bodyBuf = Buffer.from(JSON.stringify(reqBody));

  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':        'application/json',
      'Content-Length':      bodyBuf.length,
      'x-api-key':           API_KEY,
      'anthropic-version':   '2023-06-01',
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    proxyRes.pipe(res);
    log(`Anthropic API → ${proxyRes.statusCode}`);
  });

  proxyReq.on('error', (e) => {
    err('Error en proxy Anthropic: ' + e.message);
    res.writeHead(502, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({error:{type:'network',message:e.message}}));
  });

  proxyReq.write(bodyBuf);
  proxyReq.end();
}

// ── Servidor HTTP principal ────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── POST /api/chat  →  proxy a Anthropic ──
  if (req.method === 'POST' && parsed.pathname === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        log(`Chat: "${(payload.messages?.slice(-1)[0]?.content||'').slice(0,60)}..."`);
        proxyAnthropic(payload, res);
      } catch(e) {
        res.writeHead(400, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({error:{message:'JSON inválido'}}));
      }
    });
    return;
  }

  // ── GET /api/status  →  estado del servidor ──
  if (req.method === 'GET' && parsed.pathname === '/api/status') {
    res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({
      ok: true,
      apiKey: !!API_KEY,
      apiKeyPreview: API_KEY ? `${API_KEY.slice(0,12)}...${API_KEY.slice(-4)}` : null,
      node: process.version,
      port: PORT,
    }));
    return;
  }

  // ── GET /  →  sirve el HTML ──
  if (req.method === 'GET' && (parsed.pathname === '/' || parsed.pathname === '/index.html')) {
    if (!fs.existsSync(HTML_FILE)) {
      res.writeHead(404); res.end('devdeploy-manager.html no encontrado en el mismo directorio.');
      return;
    }
    const html = fs.readFileSync(HTML_FILE, 'utf8');
    // Inyectar flag para que el HTML sepa que está corriendo con servidor local
    const patched = html.replace('</head>', '<meta name="devdeploy-server" content="true"></head>');
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(patched);
    log(`Sirviendo devdeploy-manager.html`);
    return;
  }

  // ── 404 ──
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   DevDeploy Manager — Servidor Local         ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════╝${C.reset}`);
  console.log('');
  ok(`Servidor corriendo en  http://localhost:${PORT}`);
  ok(`API Key Anthropic:     ${API_KEY ? 'CONFIGURADA ✓' : 'NO configurada (modo local)'}`);
  console.log('');
  console.log(`${C.gray}  Abrí http://localhost:${PORT} en tu browser${C.reset}`);
  console.log(`${C.gray}  Ctrl+C para detener${C.reset}`);
  console.log('');
});
