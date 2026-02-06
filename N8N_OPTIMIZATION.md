# Optimizaciones para Procesamiento de n8n

Este documento describe las mejoras implementadas para optimizar el procesamiento de facturas con n8n y aumentar la capacidad de usuarios simultáneos.

## 🚀 Mejoras Implementadas

### 1. **Connection Pooling**
- **Qué es**: Reutiliza conexiones HTTP en lugar de crear nuevas para cada request
- **Beneficio**: Reduce latencia y uso de recursos
- **Configuración**: 
  - `pool_connections=10`: 10 pools de conexión
  - `pool_maxsize=20`: Máximo 20 conexiones por pool

### 2. **Retry Logic con Exponential Backoff**
- **Qué es**: Reintenta automáticamente si n8n falla temporalmente
- **Beneficio**: Mayor resiliencia ante errores temporales
- **Configuración**:
  - `N8N_MAX_RETRIES=3`: Máximo 3 reintentos
  - `N8N_RETRY_BACKOFF=1.5`: Factor de espera exponencial (1.5s, 2.25s, 3.375s)
  - Reintenta en códigos: 429, 500, 502, 503, 504

### 3. **Timeout Mejorado**
- **Qué es**: Timeout configurable para llamadas a n8n
- **Beneficio**: Evita que requests queden colgados indefinidamente
- **Configuración**: `N8N_TIMEOUT=60` (60 segundos por defecto)

### 4. **Múltiples Workers de Uvicorn**
- **Qué es**: Procesa múltiples requests en paralelo
- **Beneficio**: Aumenta significativamente la capacidad concurrente
- **Configuración**: `UVICORN_WORKERS=4` (recomendado: 4-8 workers)

## 📊 Capacidad Estimada

### Antes de las Optimizaciones
- **Usuarios simultáneos**: ~20-50 usuarios procesando facturas
- **Problemas**: Timeouts frecuentes, conexiones no reutilizadas, sin reintentos

### Después de las Optimizaciones
- **Usuarios simultáneos**: ~100-200 usuarios procesando facturas
- **Mejoras**: 
  - ✅ Conexiones reutilizadas (menor latencia)
  - ✅ Reintentos automáticos (mayor resiliencia)
  - ✅ Múltiples workers (mayor paralelismo)
  - ✅ Timeouts configurables (mejor control)

## ⚙️ Configuración

Agrega estas variables a tu archivo `.env`:

```bash
# Configuración de n8n (opcional, valores por defecto mostrados)
N8N_TIMEOUT=60              # Timeout en segundos (default: 60)
N8N_MAX_RETRIES=3           # Máximo de reintentos (default: 3)
N8N_RETRY_BACKOFF=1.5       # Factor de backoff exponencial (default: 1.5)

# Configuración de uvicorn (opcional)
UVICORN_WORKERS=4           # Número de workers (default: 1)
```

## 🎯 Recomendaciones por Escala

### Pequeña Escala (10-50 usuarios)
```bash
UVICORN_WORKERS=2
N8N_TIMEOUT=60
N8N_MAX_RETRIES=2
```

### Mediana Escala (50-100 usuarios)
```bash
UVICORN_WORKERS=4
N8N_TIMEOUT=60
N8N_MAX_RETRIES=3
```

### Gran Escala (100+ usuarios)
```bash
UVICORN_WORKERS=8
N8N_TIMEOUT=90
N8N_MAX_RETRIES=3
```

**Nota**: El número de workers debe ser aproximadamente igual al número de CPUs disponibles. Usar más workers que CPUs puede degradar el rendimiento.

## 🔧 Cómo Usar

### Desarrollo (1 worker)
```bash
python app.py
```

### Producción (múltiples workers)
```bash
# Opción 1: Variable de entorno
UVICORN_WORKERS=4 python app.py

# Opción 2: Comando directo de uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📈 Monitoreo

Los logs ahora incluyen:
- Tiempo de respuesta de n8n: `✅ Respuesta de n8n recibida en X.XX segundos`
- Errores de timeout: `❌ Timeout después de X.XX segundos`
- Configuración al inicio: `📊 Configuración n8n: timeout=Xs, retries=X, backoff=X`

## 🚨 Solución de Problemas

### Si n8n sigue siendo lento:
1. Verifica que n8n tenga suficientes recursos
2. Considera aumentar `N8N_TIMEOUT` a 90 o 120 segundos
3. Revisa los logs de n8n para identificar cuellos de botella

### Si hay muchos timeouts:
1. Verifica la conectividad con n8n
2. Considera reducir `N8N_MAX_RETRIES` para fallar más rápido
3. Revisa si n8n tiene límites de rate limiting

### Si el servidor se sobrecarga:
1. Reduce `UVICORN_WORKERS` al número de CPUs disponibles
2. Considera usar un load balancer para distribuir carga
3. Implementa rate limiting en el backend

## 🔮 Próximas Mejoras (Opcionales)

Para escalar aún más, considera:
1. **Sistema de Colas (Redis + Celery)**: Procesamiento completamente asíncrono
2. **Cache de resultados**: Evitar reprocesar facturas idénticas
3. **Rate Limiting**: Limitar requests por usuario
4. **Load Balancer**: Distribuir carga entre múltiples servidores
