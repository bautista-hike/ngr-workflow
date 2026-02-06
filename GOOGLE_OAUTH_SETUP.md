# Configuración de Google OAuth

## Pasos para configurar Google OAuth

### 1. Crear un proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google+ (si no está habilitada)

### 2. Configurar la pantalla de consentimiento OAuth

1. Ve a **APIs & Services** > **OAuth consent screen**
2. Selecciona **External** (o **Internal** si solo es para tu organización)
3. Completa la información requerida:
   - App name: "Procesamiento de Facturas"
   - User support email: tu email
   - Developer contact information: tu email
4. Agrega los scopes necesarios:
   - `openid`
   - `email`
   - `profile`
5. Guarda y continúa

### 3. Crear credenciales OAuth 2.0

1. Ve a **APIs & Services** > **Credentials**
2. Click en **Create Credentials** > **OAuth client ID**
3. Selecciona **Web application**
4. Configura:
   - **Name**: "Invoice Processing Web Client"
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `http://localhost:3000`
     - (Agrega tu dominio de producción si lo tienes)
   - **Authorized redirect URIs**:
     - `http://localhost:5173`
     - `http://localhost:3000`
     - (Agrega tu dominio de producción si lo tienes)
5. Click en **Create**
6. Copia el **Client ID** (lo necesitarás para el `.env`)

### 4. Configurar variables de entorno

Agrega el Client ID a tu archivo `.env`:

```env
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

### 5. Configurar usuarios autorizados

Edita el archivo `authorized_users.json` y agrega los emails de los usuarios que quieres autorizar:

```json
{
  "authorized_emails": [
    "usuario1@ejemplo.com",
    "usuario2@ejemplo.com"
  ]
}
```

**Importante**: Los emails deben coincidir exactamente con los emails de las cuentas de Google de los usuarios.

### 6. Reiniciar el servidor

Después de configurar todo, reinicia tanto el frontend como el backend:

```bash
# Backend
python app.py

# Frontend
npm run dev
```

## Notas de seguridad

- El archivo `authorized_users.json` contiene la lista de usuarios autorizados
- Solo los usuarios en esta lista podrán acceder a la aplicación
- Puedes agregar o quitar usuarios editando este archivo y reiniciando el backend
- El backend verifica el token de Google en cada petición para asegurar que el usuario sigue autenticado
