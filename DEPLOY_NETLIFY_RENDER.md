# Guía Completa de Deployment: Netlify (Frontend) + Render (Backend)

Esta guía te llevará paso a paso para desplegar tu aplicación completa en producción.

---

## 📋 Tabla de Contenidos

1. [Preparación Inicial](#preparación-inicial)
2. [Configuración del Backend en Render](#configuración-del-backend-en-render)
3. [Configuración del Frontend en Netlify](#configuración-del-frontend-en-netlify)
4. [Configuración de Google OAuth para Producción](#configuración-de-google-oauth-para-producción)
5. [Verificación y Pruebas](#verificación-y-pruebas)
6. [Solución de Problemas](#solución-de-problemas)

---

## 🚀 Preparación Inicial

### Paso 1: Verificar que tu código esté en Git

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
# Verificar estado de Git
git status

# Si no tienes Git inicializado:
git init
git add .
git commit -m "Initial commit"
```

### Paso 2: Subir tu código a GitHub

1. Ve a [GitHub.com](https://github.com) y crea una cuenta si no tienes una
2. Crea un nuevo repositorio (botón verde "New")
3. Nombra tu repositorio (ej: `ngr-workflow`)
4. **NO** marques "Initialize with README" (ya tienes código)
5. Haz clic en "Create repository"
6. GitHub te mostrará comandos, ejecuta estos en tu terminal:

```bash
# Reemplaza USERNAME y REPO_NAME con tus valores
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### Paso 3: Preparar archivos necesarios

Asegúrate de tener estos archivos en tu proyecto:

#### `requirements.txt` (debe existir)
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
google-cloud-bigquery==3.13.0
requests==2.31.0
urllib3==2.1.0
python-dotenv==1.0.0
pydantic==2.5.0
google-auth==2.23.4
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
```

#### `runtime.txt` (crear si no existe)
```txt
python-3.11.0
```

#### `Procfile` (crear si no existe)
```txt
web: python app.py
```

#### `.gitignore` (verificar que incluya)
```
.env
venv/
__pycache__/
*.pyc
.DS_Store
node_modules/
dist/
build/
.env.local
authorized_users.json
```

---

## 🔧 Configuración del Backend en Render

### Paso 1: Crear cuenta en Render

1. Ve a [render.com](https://render.com)
2. Haz clic en "Get Started for Free"
3. Elige "Sign up with GitHub" (recomendado) o usa email
4. Si usas GitHub, autoriza Render a acceder a tus repositorios
5. Completa el registro

### Paso 2: Crear nuevo Web Service

1. En el dashboard de Render, haz clic en "New +"
2. Selecciona "Web Service"
3. Conecta tu repositorio de GitHub:
   - Si no aparece, haz clic en "Configure account" y autoriza Render
   - Selecciona tu repositorio `ngr-workflow`
   - Haz clic en "Connect"

### Paso 3: Configurar el Web Service

Completa estos campos:

**Basic Settings:**
- **Name**: `ngr-workflow-backend` (o el nombre que prefieras)
- **Region**: Elige la región más cercana a tus usuarios (ej: `Oregon (US West)`)
- **Branch**: `main` (o la rama que uses)
- **Root Directory**: Dejar vacío (o `./` si Render lo requiere)
- **Runtime**: `Python 3`
- **Build Command**: 
  ```bash
  pip install --upgrade pip && pip install -r requirements.txt
  ```
- **Start Command**: 
  ```bash
  python app.py
  ```

**Advanced Settings (haz clic en "Advanced"):**
- **Auto-Deploy**: `Yes` (se despliega automáticamente cuando haces push)

### Paso 4: Configurar Variables de Entorno

En la sección "Environment Variables", agrega estas variables:

#### Variables Obligatorias:

```
N8N_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/xxx
BIGQUERY_PROJECT_ID=tu-project-id
BIGQUERY_DATASET_ID=tu-dataset-id
BIGQUERY_TABLE_ID=facturas
GOOGLE_APPLICATION_CREDENTIALS=/opt/render/project/src/credentials.json
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
PORT=8000
```

#### Variables Opcionales (con valores por defecto):

```
N8N_TIMEOUT=60
N8N_MAX_RETRIES=3
N8N_RETRY_BACKOFF=1.5
FRONTEND_URL=https://tu-app.netlify.app
PIP_NO_CACHE_DIR=1
PIP_DISABLE_PIP_VERSION_CHECK=1
RENDER=true
```

**⚠️ IMPORTANTE**: 
- `FRONTEND_URL` la configurarás después de crear el frontend en Netlify
- `GOOGLE_CLIENT_ID` lo configurarás en la sección de Google OAuth

### Paso 5: Subir Credenciales de Google Cloud

Render necesita acceso a tus credenciales de BigQuery. Hay dos opciones:

#### Opción A: Usar Secret Files (Recomendado)

1. En Render, ve a tu servicio
2. Ve a "Environment" → "Secret Files"
3. Haz clic en "Add Secret File"
4. **Key**: `GOOGLE_APPLICATION_CREDENTIALS`
5. **Value**: Pega el contenido completo de tu archivo JSON de credenciales de Google Cloud
6. Guarda

#### Opción B: Variable de Entorno (Alternativa)

1. Convierte tu archivo JSON a una sola línea:
   ```bash
   # En tu terminal local:
   cat credentials.json | tr -d '\n' | tr -d ' '
   ```
2. Copia el resultado
3. En Render, agrega variable de entorno:
   - **Key**: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - **Value**: (pega el JSON en una línea)
4. Modifica `app.py` para leer de esta variable (ver sección de solución de problemas)

### Paso 6: Desplegar

1. Haz clic en "Create Web Service"
2. Render comenzará a construir tu aplicación
3. Espera 5-10 minutos mientras se despliega
4. Verás logs en tiempo real
5. Cuando termine, verás una URL como: `https://ngr-workflow-backend.onrender.com`

**⚠️ NOTA**: Render puede tardar 1-2 minutos en "despertar" el servicio si está inactivo (plan gratuito).

### Paso 7: Verificar que el Backend Funciona

1. Abre la URL de tu backend en el navegador
2. Deberías ver la documentación de FastAPI (Swagger UI)
3. Si ves errores, revisa los logs en Render

---

## 🎨 Configuración del Frontend en Netlify

### Paso 1: Crear cuenta en Netlify

1. Ve a [netlify.com](https://netlify.com)
2. Haz clic en "Sign up"
3. Elige "Sign up with GitHub" (recomendado)
4. Autoriza Netlify a acceder a tus repositorios
5. Completa el registro

### Paso 2: Crear nuevo Site

1. En el dashboard de Netlify, haz clic en "Add new site"
2. Selecciona "Import an existing project"
3. Elige "Deploy with GitHub"
4. Autoriza Netlify si es necesario
5. Selecciona tu repositorio `ngr-workflow`

### Paso 3: Configurar Build Settings

Netlify detectará automáticamente que es un proyecto React/Vite. Configura:

**Build settings:**
- **Base directory**: Dejar vacío (o `./` si Netlify lo requiere)
- **Build command**: 
  ```bash
  npm install && npm run build
  ```
- **Publish directory**: 
  ```
  dist
  ```

**⚠️ NOTA**: Si Netlify no detecta automáticamente, haz clic en "Show advanced" y configura manualmente.

### Paso 4: Configurar Variables de Entorno

Antes de hacer deploy, configura las variables de entorno:

1. En la página de configuración, desplázate hasta "Environment variables"
2. Haz clic en "Add variable"
3. Agrega estas variables:

```
VITE_API_URL=https://tu-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

**⚠️ IMPORTANTE**: 
- Reemplaza `https://tu-backend.onrender.com` con la URL real de tu backend en Render
- `VITE_GOOGLE_CLIENT_ID` lo configurarás después en Google OAuth

### Paso 5: Crear archivo `netlify.toml` (Opcional pero Recomendado)

Crea un archivo `netlify.toml` en la raíz de tu proyecto:

```toml
[build]
  command = "npm install && npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Este archivo asegura que las rutas de React funcionen correctamente.

### Paso 6: Desplegar

1. Haz clic en "Deploy site"
2. Netlify comenzará a construir tu aplicación
3. Espera 2-5 minutos
4. Cuando termine, verás una URL como: `https://random-name-12345.netlify.app`

### Paso 7: Configurar Dominio Personalizado (Opcional)

1. En Netlify, ve a "Site settings" → "Domain management"
2. Haz clic en "Add custom domain"
3. Ingresa tu dominio (ej: `facturas.tudominio.com`)
4. Sigue las instrucciones para configurar DNS

---

## 🔐 Configuración de Google OAuth para Producción

### Paso 1: Configurar OAuth en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Selecciona tu proyecto
3. Ve a "APIs & Services" → "Credentials"
4. Encuentra tu OAuth 2.0 Client ID (o créalo si no existe)
5. Haz clic en el cliente para editarlo

### Paso 2: Agregar URIs Autorizados

En "Authorized JavaScript origins", agrega:
```
https://tu-app.netlify.app
https://tu-backend.onrender.com
```

En "Authorized redirect URIs", agrega:
```
https://tu-app.netlify.app
```

**⚠️ IMPORTANTE**: Reemplaza con tus URLs reales de Netlify y Render.

### Paso 3: Actualizar Variables de Entorno

**En Render (Backend):**
- Actualiza `GOOGLE_CLIENT_ID` con tu Client ID completo
- Actualiza `FRONTEND_URL` con tu URL de Netlify

**En Netlify (Frontend):**
- Actualiza `VITE_GOOGLE_CLIENT_ID` con tu Client ID completo
- Actualiza `VITE_API_URL` con tu URL de Render

### Paso 4: Redesplegar

Después de cambiar variables de entorno:

**Render:**
- Ve a tu servicio → "Manual Deploy" → "Deploy latest commit"

**Netlify:**
- Ve a "Deploys" → "Trigger deploy" → "Deploy site"

---

## ✅ Verificación y Pruebas

### Paso 1: Verificar Backend

1. Abre `https://tu-backend.onrender.com/docs`
2. Deberías ver la documentación de FastAPI
3. Prueba el endpoint `/api/debug/users` (si existe)

### Paso 2: Verificar Frontend

1. Abre tu URL de Netlify
2. Deberías ver la pantalla de login
3. Intenta iniciar sesión con Google

### Paso 3: Probar Flujo Completo

1. Inicia sesión con un usuario autorizado
2. Sube una imagen de factura
3. Verifica que se procese correctamente
4. Verifica que se guarde en BigQuery

### Paso 4: Verificar Logs

**Render:**
- Ve a tu servicio → "Logs"
- Revisa que no haya errores

**Netlify:**
- Ve a "Deploys" → Selecciona el último deploy → "Deploy log"
- Revisa que el build haya sido exitoso

---

## 🐛 Solución de Problemas

### Problema 1: Backend no inicia en Render

**Síntomas**: El servicio muestra "Build failed" o no responde

**Soluciones**:
1. Verifica que `requirements.txt` tenga todas las dependencias
2. Verifica que `Procfile` tenga el comando correcto: `web: python app.py`
3. Revisa los logs en Render para ver el error específico
4. Asegúrate de que `PORT` esté configurado como variable de entorno
5. Si ves errores de compilación con Rust/maturin:
   - Actualiza `requirements.txt` con versiones más recientes (ya actualizado)
   - Usa el Build Command: `pip install --upgrade pip && pip install -r requirements.txt`
   - Agrega variables de entorno: `PIP_NO_CACHE_DIR=1` y `PIP_DISABLE_PIP_VERSION_CHECK=1`

### Problema 2: Error de Credenciales de Google Cloud

**Síntomas**: Error al conectarse a BigQuery

**Soluciones**:
1. Verifica que `GOOGLE_APPLICATION_CREDENTIALS` apunte al archivo correcto
2. Si usas Secret Files, asegúrate de que el contenido sea válido JSON
3. Verifica que la cuenta de servicio tenga permisos en BigQuery

### Problema 3: CORS Error

**Síntomas**: El frontend no puede comunicarse con el backend

**Soluciones**:
1. Verifica que `FRONTEND_URL` en Render sea exactamente la URL de Netlify (con `https://`)
2. Verifica que `VITE_API_URL` en Netlify sea exactamente la URL de Render
3. Revisa los logs del backend para ver errores de CORS

### Problema 4: Google OAuth no funciona

**Síntomas**: Error al iniciar sesión con Google

**Soluciones**:
1. Verifica que las URLs en Google Cloud Console sean exactas (con `https://`)
2. Verifica que `VITE_GOOGLE_CLIENT_ID` en Netlify sea correcto
3. Verifica que `GOOGLE_CLIENT_ID` en Render sea correcto
4. Revisa la consola del navegador para errores específicos

### Problema 5: Frontend muestra página en blanco

**Síntomas**: Netlify muestra la página pero está vacía

**Soluciones**:
1. Verifica que `netlify.toml` tenga la configuración de redirects
2. Verifica que el build haya sido exitoso (revisa logs)
3. Abre la consola del navegador para ver errores JavaScript
4. Verifica que las variables de entorno empiecen con `VITE_`

### Problema 6: Backend se "duerme" en Render (Plan Gratuito)

**Síntomas**: El backend tarda mucho en responder después de inactividad

**Solución**: 
- Esto es normal en el plan gratuito de Render
- El servicio se "despierta" automáticamente después de 1-2 minutos
- Considera usar un servicio de "ping" para mantenerlo activo (ej: UptimeRobot)

### Problema 7: Error al procesar facturas

**Síntomas**: El procesamiento de facturas falla

**Soluciones**:
1. Verifica que `N8N_WEBHOOK_URL` sea correcta y accesible desde internet
2. Verifica que n8n esté configurado para aceptar requests desde Render
3. Revisa los logs del backend para ver el error específico

---

## 📝 Checklist Final

Antes de considerar el deployment completo, verifica:

### Backend (Render)
- [ ] Servicio desplegado y funcionando
- [ ] Variables de entorno configuradas
- [ ] Credenciales de Google Cloud configuradas
- [ ] CORS configurado con URL de Netlify
- [ ] Logs sin errores críticos

### Frontend (Netlify)
- [ ] Site desplegado y funcionando
- [ ] Variables de entorno configuradas (`VITE_*`)
- [ ] Build exitoso
- [ ] Redirecciones configuradas (`netlify.toml`)

### Google OAuth
- [ ] URLs autorizadas en Google Cloud Console
- [ ] Client ID configurado en ambas plataformas
- [ ] Login funciona correctamente

### Funcionalidad
- [ ] Login con Google funciona
- [ ] Subida de facturas funciona
- [ ] Procesamiento con n8n funciona
- [ ] Guardado en BigQuery funciona
- [ ] Manejo de errores funciona

---

## 🔄 Actualizaciones Futuras

### Para actualizar el Backend:

1. Haz cambios en tu código local
2. Haz commit y push a GitHub:
   ```bash
   git add .
   git commit -m "Descripción de cambios"
   git push
   ```
3. Render detectará automáticamente y desplegará (si Auto-Deploy está activado)

### Para actualizar el Frontend:

1. Haz cambios en tu código local
2. Haz commit y push a GitHub:
   ```bash
   git add .
   git commit -m "Descripción de cambios"
   git push
   ```
3. Netlify detectará automáticamente y desplegará

### Para cambiar Variables de Entorno:

**Render:**
- Ve a tu servicio → "Environment" → Edita variables → "Save Changes"
- Render redesplegará automáticamente

**Netlify:**
- Ve a "Site settings" → "Environment variables" → Edita → "Save"
- Ve a "Deploys" → "Trigger deploy" → "Deploy site"

---

## 💡 Tips Adicionales

1. **Monitoreo**: Considera usar servicios como UptimeRobot para monitorear tu backend
2. **Logs**: Revisa regularmente los logs en ambas plataformas
3. **Backups**: Asegúrate de tener backups de `authorized_users.json`
4. **Seguridad**: Nunca subas archivos `.env` o credenciales a GitHub
5. **Performance**: En producción, considera aumentar `UVICORN_WORKERS` a 4-8

---

## 📞 Recursos Adicionales

- [Documentación de Render](https://render.com/docs)
- [Documentación de Netlify](https://docs.netlify.com)
- [Documentación de FastAPI](https://fastapi.tiangolo.com)
- [Documentación de Vite](https://vitejs.dev)

---

¡Felicitaciones! Tu aplicación debería estar funcionando en producción. 🎉
