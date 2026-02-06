-- Script para agregar columnas de auditoría a la tabla de facturas en BigQuery
-- Ejecuta este script en BigQuery Console para agregar las nuevas columnas

-- Agregar columna de timestamp de carga
ALTER TABLE `tu-project-id.tu-dataset-id.facturas`
ADD COLUMN IF NOT EXISTS fecha_carga TIMESTAMP;

-- Agregar columna de usuario que hizo la carga
ALTER TABLE `tu-project-id.tu-dataset-id.facturas`
ADD COLUMN IF NOT EXISTS usuario_carga STRING;

-- Nota: Reemplaza 'tu-project-id', 'tu-dataset-id' y 'facturas' con tus valores reales
-- Ejemplo:
-- ALTER TABLE `bigquery-388915.dataset_facturas.facturas`
-- ADD COLUMN IF NOT EXISTS fecha_carga TIMESTAMP;
-- 
-- ALTER TABLE `bigquery-388915.dataset_facturas.facturas`
-- ADD COLUMN IF NOT EXISTS usuario_carga STRING;
