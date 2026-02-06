# Guía de Deploy - Paso a Paso

## Opción Recomendada: Vercel (Frontend) + Railway (Backend)

### 📋 Requisitos Previos
1. Cuenta en GitHub (gratis)
2. Cuenta en Vercel (gratis, conecta con GitHub)
3. Cuenta en Railway (gratis, conecta con GitHub)

---

## 🚀 Paso 1: Preparar el Repositorio en GitHub

1. **Crea un repositorio en GitHub** (si no lo tienes):
   - Ve a https://github.com/new
   - Nombra tu repositorio (ej: `ngr-invoice-processor`)
   - Crea el repositorio

2. **Sube tu código a GitHub**:
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

## 🎨 Paso 2: Deploy del Frontend en Vercel

### 2.1. Crear archivo de configuración para Vercel

Crea un archivo `vercel.json` en la raíz del proyecto:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://TU-BACKEND-URL.railway.app/api/$1"
    }
  ]
}
```

### 2.2. Configurar variables de entorno en Vercel

1. Ve a https://vercel.com y conéctate con GitHub
2. Importa tu repositorio
3. En "Settings" → "Environment Variables", agrega:
   - `VITE_GOOGLE_CLIENT_ID`: Tu Google Client ID
   - `VITE_API_URL`: La URL de tu backend (la obtendrás después de deployar el backend)

### 2.3. Deploy automático

Vercel detectará automáticamente que es un proyecto Vite y hará el deploy. 
Tu frontend estará disponible en: `https://tu-proyecto.vercel.app`

---

## ⚙️ Paso 3: Deploy del Backend en Railway

### 3.1. Crear archivos necesarios

Crea un archivo `Procfile` en la raíz del proyecto (para Railway):

```
web: python app.py
```

Crea un archivo `runtime.txt` (opcional, para especificar versión de Python):

```
python-3.11
```

### 3.2. Actualizar app.py para producción

Asegúrate de que `app.py` tenga esta configuración al final:

```python
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

### 3.3. Deploy en Railway

1. Ve a https://railway.app y conéctate con GitHub
2. Click en "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repositorio
4. Railway detectará automáticamente que es Python

### 3.4. Configurar variables de entorno en Railway

En Railway, ve a tu proyecto → "Variables" y agrega todas las variables de tu `.env`:
- `N8N_WEBHOOK_URL`
- `GOOGLE_APPLICATION_CREDENTIALS` (o sube el archivo JSON)
- `BIGQUERY_PROJECT_ID`
- `BIGQUERY_DATASET_ID`
- `BIGQUERY_TABLE_ID`
- `GOOGLE_CLIENT_ID`
- `PORT` (Railway lo asigna automáticamente, pero puedes dejarlo)

### 3.5. Obtener la URL del backend

En Railway, ve a "Settings" → "Networking" → "Generate Domain"
Tu backend estará en: `https://tu-proyecto.railway.app`

---

## 🔗 Paso 4: Conectar Frontend y Backend

### 4.1. Actualizar Vercel con la URL del backend

1. Ve a Vercel → Tu proyecto → "Settings" → "Environment Variables"
2. Actualiza `VITE_API_URL` con la URL de Railway: `https://tu-proyecto.railway.app`
3. Haz un nuevo deploy (Vercel lo hará automáticamente o puedes hacerlo manualmente)

### 4.2. Configurar CORS en el backend

Asegúrate de que en `app.py` tengas configurado CORS para aceptar requests de Vercel:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://tu-proyecto.vercel.app",  # Agrega tu dominio de Vercel
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## ✅ Paso 5: Verificar que todo funcione

1. **Frontend**: Visita `https://tu-proyecto.vercel.app`
2. **Backend**: Visita `https://tu-proyecto.railway.app/` (debería mostrar el mensaje de API)
3. Prueba hacer login y subir una factura

---

## 🔧 Alternativas Más Sencillas (Si prefieres)

### Opción A: Todo en Railway (Frontend + Backend)

Railway puede servir tanto el frontend como el backend:
1. Deploya el backend como servicio principal
2. Agrega el frontend como otro servicio en el mismo proyecto
3. Configura el build del frontend para que apunte al backend

### Opción B: Netlify (Frontend) + Render (Backend)

- **Netlify**: Similar a Vercel, muy fácil para frontend
- **Render**: Similar a Railway, gratis para backend

---

## 📝 Notas Importantes

1. **Google OAuth**: Asegúrate de agregar tus dominios de producción en Google Cloud Console:
   - Ve a Google Cloud Console → APIs & Services → Credentials
   - Edita tu OAuth 2.0 Client ID
   - Agrega `https://tu-proyecto.vercel.app` a "Authorized JavaScript origins"
   - Agrega `https://tu-proyecto.vercel.app` a "Authorized redirect URIs"

2. **Archivos sensibles**: Nunca subas `.env` a GitHub. Usa `.gitignore`:
   ```
   .env
   .env.local
   *.json
   !package.json
   !package-lock.json
   ```

3. **Logs**: Puedes ver los logs en:
   - Vercel: Dashboard → Tu proyecto → "Deployments" → Click en un deploy → "Logs"
   - Railway: Dashboard → Tu proyecto → "Deployments" → Click en un deploy → "Logs"

---

## 🆘 Troubleshooting

### Error: CORS
- Verifica que la URL del frontend esté en `allow_origins` del backend

### Error: Variables de entorno no encontradas
- Verifica que todas las variables estén configuradas en Railway/Vercel

### Error: Backend no responde
- Verifica los logs en Railway
- Asegúrate de que el puerto sea `PORT` (variable de entorno) y no hardcodeado

### Error: Google OAuth no funciona
- Verifica que los dominios estén configurados en Google Cloud Console
- Verifica que `VITE_GOOGLE_CLIENT_ID` esté configurado en Vercel
