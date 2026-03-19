# DevDeploy Manager — Inicio Rápido

## Modo recomendado: servidor local con env var

Ambos archivos deben estar en la MISMA carpeta:
```
devdeploy-manager.html
server.js
```

### Windows (CMD)
```cmd
set ANTHROPIC_API_KEY=sk-ant-api03-...
node server.js
```

### Windows (PowerShell)
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."
node server.js
```

### Linux / macOS
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
node server.js
```

Luego abrí: **http://localhost:8090**

---

## Modo archivo (sin servidor)

Abrí `devdeploy-manager.html` directamente en el browser.
El ChatBot usará respuestas locales inteligentes (sin Claude real).
Podés ingresar tu API key manualmente en el panel del chat.

---

## Puerto personalizado

```bash
PORT=3000 node server.js   # Linux/Mac
set PORT=3000 && node server.js  # Windows CMD
```
