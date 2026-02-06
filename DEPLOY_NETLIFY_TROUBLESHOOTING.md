# Solución de Problemas de Deploy en Netlify

## Problema: Netlify detecta Python y falla antes de instalar dependencias

### Síntomas
- El log se detiene en "Preparing Git Reference refs/heads/main"
- No se muestra el error real
- El build nunca llega a "Starting to install dependencies"

### Causa Raíz
Netlify detecta automáticamente archivos de Python (`requirements.txt`, `runtime.txt`, `Procfile`) y intenta configurar Python ANTES de procesar Node.js. Esto ocurre durante la fase de detección automática, antes de que `.netlifyignore` tenga efecto.

### Soluciones Aplicadas

1. **Eliminado `.mise.toml`**: Este archivo causaba errores de parsing TOML
2. **Agregado `engines` a `package.json`**: Fuerza el uso de Node.js 20
3. **Mejorado `netlify.toml`**: Variables de entorno para deshabilitar Python:
   - `PYTHON_VERSION = ""`
   - `MISE_PYTHON = ""`
   - `PIPENV_PYTHON = ""`
   - `SKIP_PYTHON_INSTALL = "true"`
   - `NPM_CONFIG_PYTHON = ""`
4. **Simplificado `.netlifyignore`**: Ignora todos los archivos de Python
5. **Agregado `.nvmrc`**: Especifica Node.js 20 explícitamente

### Si el Problema Persiste

#### Opción 1: Configurar en el Dashboard de Netlify
1. Ve a **Site settings** → **Build & deploy** → **Environment**
2. Agrega estas variables:
   - `PYTHON_VERSION` = (vacío)
   - `SKIP_PYTHON_INSTALL` = `true`
   - `NODE_VERSION` = `20`

#### Opción 2: Usar Build Hook Personalizado
Si Netlify sigue detectando Python, puedes crear un build hook que ignore la detección:

```bash
# En netlify.toml, cambiar el comando a:
[build]
  command = "echo 'Skipping Python detection' && npm ci && npm run build"
```

#### Opción 3: Mover Archivos de Python (NO RECOMENDADO)
Mover `requirements.txt`, `runtime.txt`, `Procfile` a un subdirectorio `backend/` rompería el deploy en Render. Solo usar si Netlify es crítico y Render no.

### Verificación
1. El build local funciona: `npm run build`
2. `package.json` tiene `engines.node = ">=20.0.0"`
3. `netlify.toml` tiene todas las variables de Python deshabilitadas
4. `.nvmrc` existe con `20`

### Logs Útiles
Si el problema persiste, busca en los logs de Netlify:
- `mise python@python-3.11` → Netlify está detectando Python
- `python-build: definition not found` → Error de instalación de Python
- `Starting to install dependencies` → ✅ Llegó a Node.js correctamente
