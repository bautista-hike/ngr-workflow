# 🔧 Fix para Start Command en Render

## Problema
Render está buscando `app.py` en `/opt/render/project/src/app.py` pero el archivo está en `backend/app.py`.

## Solución

### Opción 1: Usar ruta completa (Recomendado)

En el dashboard de Render, actualiza el **Start Command** a:

```bash
cd /opt/render/project/src/backend && python app.py
```

### Opción 2: Usar PYTHONPATH

En el dashboard de Render, actualiza el **Start Command** a:

```bash
PYTHONPATH=/opt/render/project/src/backend python /opt/render/project/src/backend/app.py
```

### Opción 3: Usar rootDir en render.yaml (Si Render lo soporta)

Si Render soporta `rootDir`, puedes configurarlo en `render.yaml`:

```yaml
services:
  - type: web
    name: ngr-workflow-backend
    env: python
    buildCommand: pip install --upgrade pip && pip install -r requirements.txt
    startCommand: python app.py
    rootDir: backend
```

## Pasos para aplicar la solución

1. Ve a tu servicio en Render
2. Ve a **Settings** → **Start Command**
3. Cambia el comando a una de las opciones de arriba
4. Guarda los cambios
5. Render redesplegará automáticamente

## Verificación

Después de cambiar el Start Command, verifica en los logs que:
- El comando se ejecuta correctamente
- `app.py` se encuentra y ejecuta
- El servidor inicia en el puerto correcto

## Nota sobre authorized_users.json

Si `authorized_users.json` no está en `backend/`, necesitarás:
1. Crearlo manualmente en Render (usando el shell o variables de entorno)
2. O moverlo a `backend/` localmente y agregarlo al repositorio (si no contiene información sensible)
