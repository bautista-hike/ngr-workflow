# 🔐 Configuración Final del Login - Netlify + Render

## ✅ Checklist de Configuración

### 1. Google Cloud Console - OAuth 2.0

**Necesitas agregar la URL de Netlify a Google OAuth:**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a **APIs & Services** → **Credentials**
4. Haz clic en tu **OAuth 2.0 Client ID** (el que usas para el login)
5. En **Authorized JavaScript origins**, agrega:
   ```
   https://tu-sitio.netlify.app
   ```
   (Reemplaza `tu-sitio` con tu URL real de Netlify)

6. En **Authorized redirect URIs**, agrega:
   ```
   https://tu-sitio.netlify.app
   ```
   (Mismo URL, sin ruta adicional)

7. Haz clic en **Save**

**⚠️ IMPORTANTE:**
- Si tu URL de Netlify es `https://amazing-app-123.netlify.app`, agrega exactamente esa URL
- No agregues rutas como `/callback` o `/auth` - solo la URL base
- Los cambios pueden tardar unos minutos en aplicarse

---

### 2. Variables de Entorno en Netlify

**Configura estas variables en Netlify:**

1. Ve a tu sitio en Netlify
2. Ve a **Site settings** → **Environment variables**
3. Agrega/verifica estas variables:

```
VITE_API_URL=https://tu-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

**⚠️ IMPORTANTE:**
- `VITE_API_URL` debe ser la URL completa de tu backend en Render (con `https://`)
- `VITE_GOOGLE_CLIENT_ID` es el Client ID completo de Google (ej: `624953786850-6ka3nak3...apps.googleusercontent.com`)
- Después de agregar/modificar variables, necesitas **redesplegar** el sitio

**Para redesplegar:**
- Ve a **Deploys** → **Trigger deploy** → **Deploy site**

---

### 3. Variables de Entorno en Render (Backend)

**Verifica estas variables en Render:**

1. Ve a tu servicio en Render
2. Ve a **Environment**
3. Verifica/agrega estas variables:

```
FRONTEND_URL=https://tu-sitio.netlify.app
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/tu-archivo.json
BIGQUERY_PROJECT_ID=tu-project-id
BIGQUERY_DATASET_ID=tu-dataset-id
BIGQUERY_TABLE_ID=facturas
N8N_WEBHOOK_URL=https://tu-webhook-n8n.com/webhook
PORT=8000
```

**⚠️ IMPORTANTE:**
- `FRONTEND_URL` debe ser la URL completa de Netlify (con `https://`)
- Esto permite que el backend acepte requests desde Netlify (CORS)
- Después de cambiar variables, haz **Manual Deploy** → **Deploy latest commit**

---

## 🔍 Verificación Paso a Paso

### Paso 1: Verificar Backend en Render

1. Abre `https://tu-backend.onrender.com/docs`
2. Deberías ver la documentación de FastAPI (Swagger UI)
3. Si no funciona, revisa los logs en Render

### Paso 2: Verificar Frontend en Netlify

1. Abre tu URL de Netlify
2. Deberías ver la pantalla de login
3. Abre la consola del navegador (F12) y verifica:
   - No debería haber errores de `VITE_GOOGLE_CLIENT_ID`
   - No debería haber errores de `VITE_API_URL`

### Paso 3: Probar Login

1. Haz clic en "Continuar con Google"
2. Selecciona tu cuenta de Google
3. Si todo está bien configurado, deberías:
   - Ver la pantalla principal de la aplicación
   - Poder subir facturas

### Paso 4: Verificar CORS

Si ves errores de CORS en la consola:

1. Verifica que `FRONTEND_URL` en Render sea exactamente la URL de Netlify
2. Verifica que `VITE_API_URL` en Netlify sea exactamente la URL de Render
3. Revisa los logs del backend en Render para ver errores de CORS

---

## 🐛 Problemas Comunes

### Error: "VITE_GOOGLE_CLIENT_ID no está configurado"

**Solución:**
- Agrega `VITE_GOOGLE_CLIENT_ID` en Netlify → Environment variables
- Redespliega el sitio

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solución:**
- Verifica que `FRONTEND_URL` en Render sea la URL exacta de Netlify
- Verifica que `VITE_API_URL` en Netlify sea la URL exacta de Render
- Haz redeploy de ambos servicios

### Error: "redirect_uri_mismatch" en Google OAuth

**Solución:**
- Verifica que agregaste la URL de Netlify en Google Cloud Console
- La URL debe coincidir exactamente (con `https://`, sin trailing slash)
- Espera unos minutos después de guardar en Google Cloud Console

### Error: "401 Unauthorized" al hacer login

**Solución:**
- Verifica que tu email esté en `authorized_users.json` en el backend
- Verifica que el archivo `authorized_users.json` esté en Render (en el directorio `backend/`)
- Si no existe, créalo manualmente o agrega usuarios desde el superadmin

---

## 📝 Resumen de URLs Necesarias

1. **URL de Netlify (Frontend):**
   - Ejemplo: `https://amazing-app-123.netlify.app`
   - Se usa en: Google OAuth (Authorized origins), Render (FRONTEND_URL)

2. **URL de Render (Backend):**
   - Ejemplo: `https://ngr-workflow-backend.onrender.com`
   - Se usa en: Netlify (VITE_API_URL)

3. **Google Client ID:**
   - Ejemplo: `624953786850-6ka3nak3...apps.googleusercontent.com`
   - Se usa en: Netlify (VITE_GOOGLE_CLIENT_ID), Render (GOOGLE_CLIENT_ID)

---

## ✅ Checklist Final

- [ ] URL de Netlify agregada en Google Cloud Console (Authorized origins)
- [ ] `VITE_API_URL` configurado en Netlify (URL de Render)
- [ ] `VITE_GOOGLE_CLIENT_ID` configurado en Netlify
- [ ] `FRONTEND_URL` configurado en Render (URL de Netlify)
- [ ] `GOOGLE_CLIENT_ID` configurado en Render
- [ ] Backend redesplegado en Render
- [ ] Frontend redesplegado en Netlify
- [ ] Login funciona correctamente

---

¡Listo! Con estos pasos deberías tener el login funcionando correctamente. 🎉
