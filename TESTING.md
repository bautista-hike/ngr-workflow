# Guía de Pruebas

## Checklist Antes de Probar

### ✅ 1. Webhook de n8n Activo
- Ve a tu instancia de n8n
- Asegúrate de que el workflow con el webhook esté **ACTIVO** (toggle verde)
- El webhook debe estar escuchando en: `/webhook/invoice-extraction`

### ✅ 2. Backend Corriendo
```bash
# Verificar que el backend esté en el puerto 8000
lsof -ti:8000
```

Si no está corriendo:
```bash
python app.py
```

### ✅ 3. Frontend Corriendo
```bash
# Verificar que el frontend esté en el puerto 5173
lsof -ti:5173
```

Si no está corriendo:
```bash
npm run dev
```

### ✅ 4. Configuración del .env
Verifica que tu `.env` tenga:
- `N8N_WEBHOOK_URL` configurado correctamente
- `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo JSON
- `BIGQUERY_PROJECT_ID`, `BIGQUERY_DATASET_ID`, `BIGQUERY_TABLE_ID` configurados

## Prueba del Flujo Completo

### Paso 1: Abrir el Frontend
Abre en tu navegador:
```
http://localhost:5173
```

### Paso 2: Subir una Imagen de Factura
1. Arrastra o selecciona una imagen de factura (JPG, PNG, etc.)
2. Haz clic en **"Procesar Factura"**
3. Espera a que se procese (puede tardar unos segundos)

### Paso 3: Verificar los Datos Extraídos
- Deberías ver un formulario con los datos extraídos
- Revisa que los campos estén llenos:
  - CUIT, Fecha, Total, Nombre del Comercio, etc.
- **Completa el campo "Canal"** (es requerido)

### Paso 4: Guardar en BigQuery
1. Revisa y corrige los datos si es necesario
2. Haz clic en **"Confirmar y Guardar"**
3. Deberías ver un mensaje de éxito

## Prueba del Webhook Directamente

Puedes probar el webhook de n8n directamente con curl:

```bash
curl -X POST https://n8n.hikethecloud.com/webhook/invoice-extraction \
  -F "invoice_image=@/ruta/a/tu/factura.jpg" \
  -v
```

Deberías recibir una respuesta JSON con:
```json
{
  "extracted_text": "015 SAN MARTIN\nAV. SAN MARTIN 420\n..."
}
```

## Solución de Problemas

### Error: "URL de webhook n8n no configurada"
- Verifica que el archivo `.env` tenga `N8N_WEBHOOK_URL`
- Reinicia el backend después de cambiar el `.env`

### Error: "Error al llamar al servicio de extracción"
- Verifica que el workflow de n8n esté **ACTIVO**
- Verifica que la URL del webhook sea correcta
- Revisa los logs de n8n para ver si hay errores

### Error: "No se pudo extraer texto de la imagen"
- Verifica que el webhook de n8n devuelva `{"extracted_text": "..."}`
- Revisa que Google Vision AI esté configurado correctamente en n8n

### Error: "BigQuery no está configurado correctamente"
- Verifica que `GOOGLE_APPLICATION_CREDENTIALS` apunte al archivo JSON correcto
- Verifica que el archivo JSON de credenciales exista
- Verifica que los permisos de la service account sean correctos

### Error: "Error al insertar en BigQuery"
- Verifica que la tabla exista en BigQuery
- Verifica que el esquema de la tabla coincida
- Revisa los logs del backend para más detalles

## Verificar Logs

### Backend
Los logs del backend mostrarán:
- Errores de conexión con n8n
- Errores de parsing
- Errores de BigQuery

### Frontend
Abre la consola del navegador (F12) para ver:
- Errores de red
- Errores de la API
- Respuestas del backend
