# 🚀 Deploy Sencillo - Guía Rápida

## Opción Más Sencilla: Railway (Todo en uno)

Railway puede deployar tanto el frontend como el backend fácilmente.

---

## 📦 Paso 1: Preparar el Repositorio

1. **Crea un repositorio en GitHub** (si no lo tienes)
2. **Sube tu código**:
```bash
cd /Users/bautiballatore/Desktop/NGR-workflow
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

---

## 🚂 Paso 2: Deploy en Railway

### 2.1. Crear cuenta y proyecto

1. Ve a https://railway.app
2. Click en "Login" → Conecta con GitHub
3. Click en "New Project"
4. Selecciona "Deploy from GitHub repo"
5. Elige tu repositorio

### 2.2. Configurar el Backend

1. Railway detectará automáticamente que hay un `app.py`
2. Ve a "Settings" → "Variables" y agrega:
   - `N8N_WEBHOOK_URL`: Tu webhook de n8n
   - `BIGQUERY_PROJECT_ID`: Tu proyecto de BigQuery
   - `BIGQUERY_DATASET_ID`: Tu dataset
   - `BIGQUERY_TABLE_ID`: Tu tabla
   - `GOOGLE_CLIENT_ID`: Tu Google Client ID
   - `FRONTEND_URL`: La URL que Railway te dará (ej: `https://tu-proyecto.railway.app`)

3. **Para las credenciales de Google Cloud**:
   - Ve a "Settings" → "Variables"
   - Crea una variable `GOOGLE_APPLICATION_CREDENTIALS`
   - Pega el contenido completo de tu archivo JSON de credenciales
   - O mejor: sube el archivo como "Secret File" en Railway

4. Railway automáticamente:
   - Instalará las dependencias (`pip install -r requirements.txt`)
   - Ejecutará `python app.py`
   - Te dará una URL pública

### 2.3. Configurar el Frontend (Opcional - en Railway)

Si quieres servir el frontend también desde Railway:

1. En Railway, click en "New Service"
2. Selecciona "GitHub Repo" → Tu mismo repositorio
3. En "Settings" → "Build Command": `npm install && npm run build`
4. En "Settings" → "Start Command": `npm run preview` (o usa un servidor estático)
5. Agrega variables:
   - `VITE_API_URL`: La URL de tu backend en Railway
   - `VITE_GOOGLE_CLIENT_ID`: Tu Google Client ID

---

## 🎨 Alternativa: Frontend en Vercel (Más fácil para frontend)

### Paso 1: Deploy Frontend en Vercel

1. Ve a https://vercel.com → Conecta con GitHub
2. Click en "Add New Project"
3. Selecciona tu repositorio
4. Vercel detectará automáticamente que es Vite
5. En "Environment Variables", agrega:
   - `VITE_API_URL`: La URL de tu backend en Railway
   - `VITE_GOOGLE_CLIENT_ID`: Tu Google Client ID
6. Click en "Deploy"

**¡Listo!** Tu frontend estará en `https://tu-proyecto.vercel.app`

### Paso 2: Actualizar Backend con URL del Frontend

1. En Railway → Tu proyecto backend → "Settings" → "Variables"
2. Actualiza `FRONTEND_URL` con: `https://tu-proyecto.vercel.app`

---

## ✅ Verificar

1. **Backend**: Visita `https://tu-backend.railway.app/` → Debería mostrar `{"message":"Invoice Processing API","status":"running"}`
2. **Frontend**: Visita `https://tu-frontend.vercel.app` → Debería cargar la aplicación
3. Prueba hacer login y subir una factura

---

## 🔧 Configuración de Google OAuth

**IMPORTANTE**: Debes agregar tus dominios de producción en Google Cloud:

1. Ve a https://console.cloud.google.com
2. APIs & Services → Credentials
3. Edita tu OAuth 2.0 Client ID
4. En "Authorized JavaScript origins", agrega:
   - `https://tu-frontend.vercel.app`
   - `https://tu-backend.railway.app` (si aplica)
5. En "Authorized redirect URIs", agrega:
   - `https://tu-frontend.vercel.app`

---

## 💡 Tips

- **Railway**: Tiene un plan gratuito con $5 de crédito mensual (suficiente para proyectos pequeños)
- **Vercel**: Plan gratuito generoso, perfecto para frontend
- **Logs**: Puedes ver logs en tiempo real en ambos servicios
- **Variables de entorno**: Nunca subas `.env` a GitHub, usa las variables del servicio

---

## 🆘 Problemas Comunes

### Error: "Module not found"
- Verifica que `requirements.txt` tenga todas las dependencias
- Railway instalará automáticamente, pero revisa los logs

### Error: CORS
- Verifica que `FRONTEND_URL` esté configurada correctamente en Railway
- Debe ser la URL exacta de tu frontend (con https://)

### Error: Google OAuth no funciona
- Verifica que los dominios estén en Google Cloud Console
- Verifica que `VITE_GOOGLE_CLIENT_ID` esté configurado en Vercel

### Error: BigQuery no conecta
- Verifica que las credenciales de Google Cloud estén configuradas
- Puedes subir el archivo JSON como "Secret File" en Railway
