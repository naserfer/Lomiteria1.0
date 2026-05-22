# 🗄️ DATABASE - Sistema POS Multi-Tenant

## 📋 **Orden de Ejecución (Setup Inicial)**

### **1️⃣ Crear Schema Base (v1.1 - Ultra Profesional)**

```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: 00_initial_schema.sql
```

**¿Qué hace?**
- ✅ Crea todas las tablas (tenants, usuarios, productos, clientes, pedidos, etc.)
- ✅ Configura sistema de puntos automático (acumula 5% de la venta)
- ✅ Configura inventario con control de stock
- ✅ Crea tablas de ingredientes y recetas
- ✅ Agrega índices para optimización
- ✅ Crea vistas útiles (stock bajo, cuenta corriente de puntos)
- ✅ Inserta tenant de ejemplo "Lomitería Don Juan"
- 🔥 **NUEVO:** Soft Delete en tablas críticas
- 🔥 **NUEVO:** config_json flexible en tenants
- 🔥 **NUEVO:** tenant_id en TODAS las tablas
- 🔥 **NUEVO:** Índices optimizados con filtros
- 🔥 **NUEVO:** Numeración automática por tenant para pedidos
- 🔥 **NUEVO:** Pedidos quedan entregados automáticamente al confirmar cobro

---

### **2️⃣ Cargar Datos de Atlas Burger**

```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: ../seeds/atlas-burger.sql
```

**¿Qué hace?**
- ✅ Actualiza el tenant "Lomitería Don Juan" a "Atlas Burger"
- ✅ Carga todas las categorías del menú real
- ✅ Carga todos los productos con precios en Guaraníes
- ✅ Carga ingredientes base (panes, carnes, quesos, etc.)
- ✅ Carga recetas de productos (qué ingredientes lleva cada hamburguesa)

---

### **3️⃣ Configurar Impresoras**

```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: 02_printer_config.sql
```

**¿Qué hace?**
- ✅ Crea la tabla `printer_config` para conectar lomiterías con impresoras
- ✅ Inserta configuración de ejemplo para Atlas Burger
- ⚠️ **IMPORTANTE:** Antes de ejecutar, ajusta la IP en el script (línea ~60)

**Configuración requerida:**
1. Obtener la IP de tu PC: `ipconfig` en PowerShell
2. Editar `02_printer_config.sql` y cambiar `v_agent_ip` por tu IP real
3. Ejecutar el script en Supabase SQL Editor
4. Verificar con: `SELECT * FROM vista_printer_config WHERE lomiteria_slug = 'atlas-burger'`

**Más información:** Ver `docs/ARQUITECTURA_IMPRESION.md`

---

### **4️⃣ (Opcional) Aplicar Mejoras de Escalabilidad**

```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: 01_migration_escalabilidad.sql
```

**¿Qué hace?**
- ✅ Agrega índices adicionales para performance
- ✅ Implementa Row Level Security (RLS) completo
- ✅ Agrega constraints de integridad
- ✅ Optimiza para miles de lomiterías

**⚠️ NOTA:** Este paso es opcional por ahora. Solo ejecutarlo cuando estés listo para producción.

---

## 🚀 **Guía Rápida de Setup**

### **Para un Proyecto Nuevo:**

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Abrir **SQL Editor**
3. Copiar y ejecutar `00_initial_schema.sql` ✅
4. Copiar y ejecutar `../seeds/atlas-burger.sql` ✅
5. Editar `02_printer_config.sql` y cambiar la IP (línea ~60) ⚠️
6. Copiar y ejecutar `02_printer_config.sql` ✅
7. Listo! 🎉

---

## 📊 **Estructura de la Base de Datos**

```
┌─────────────────────────────────────────────────────┐
│                     TENANTS                         │
│  (Lomiterías registradas)                           │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┼───────────┬─────────────┬────────────┐
       │           │           │             │            │
   USUARIOS   CATEGORIAS  PRODUCTOS   CLIENTES   PROMOCIONES
       │           │           │             │
       │           └───────────┤             │
       │                       │             │
       │                   PEDIDOS ──────────┘
       │                       │
       │                 ITEMS_PEDIDO
       │                       │
       └───────────────────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
  INVENTARIO  INGREDIENTES  TRANSACCIONES_PUNTOS
       │           │
  MOVIMIENTOS  RECETAS_PRODUCTO
```

---

## 🔑 **Conceptos Clave**

### **Multi-Tenant**
- Cada lomitería tiene su `tenant_id`
- Los datos están 100% aislados por tenant
- Un usuario solo ve datos de su lomitería

### **Sistema de Puntos**
- **Automático:** Se acreditan cuando un pedido pasa a `entregado`
- **Cálculo:** 5% del total del pedido en puntos
- **Historial:** Tabla `transacciones_puntos` guarda todo

### **Numeración de Pedidos**
- Tabla `tenant_pedido_counters` guarda el último número de cada tenant
- Trigger `trigger_asignar_numero_pedido` asigna numeración cíclica
- Regla vigente: `numero_pedido` se mantiene en `1..999` y al llegar a `999` reinicia en `1`
- Para evitar colisiones históricas, se usa `pedido_ciclo` y unicidad compuesta `(tenant_id, pedido_ciclo, numero_pedido)`
- No es necesario enviar `numero_pedido` desde el front-end

### **Pedidos Instantáneos**
- En POS el cajero cobra y el pedido queda en estado `entregado`
- Eliminamos estados intermedios para registrar ventas más rápido
- Si más adelante querés reactivar KDS, podés modificar el default sin romper nada

### **Inventario**
- **Por Ingrediente:** No por producto final
- **Automático:** Se descuenta al confirmar pedido (si `controlar_stock = true`)
- **Recetas:** Tabla `recetas_producto` define qué ingredientes lleva cada producto

### **Ingredientes y Recetas**
- **Ingredientes:** Catálogo de materias primas (pan, carne, queso, etc.)
- **Recetas:** Definen qué y cuánto de cada ingrediente lleva un producto
- **Extras:** Los clientes pueden agregar ingredientes extra con costo adicional

---

## 📝 **Historial de Migraciones**

| # | Archivo | Fecha | Descripción | Estado |
|---|---------|-------|-------------|--------|
| 00 | `00_initial_schema.sql` | 2024-11-24 | Schema base multi-tenant v1.1 (Ultra Profesional) | ✅ Listo |
| 02 | `02_printer_config.sql` | 2024-12-XX | Tabla de configuración de impresoras | ✅ Listo |
| 01 | `01_migration_escalabilidad.sql` | 2024-11-24 | RLS completo y optimizaciones adicionales | ⏸️ Opcional |
| 31 | `31_pedidos_numero_ciclo.sql` | 2026-05-19 | Numeración cíclica 1..999 con `pedido_ciclo` para evitar colisiones históricas | ✅ Listo |

### **Changelog v1.1 (Mejoras Ultra Profesionales)**

🔥 **Soft Delete Implementado:**
- Tablas: `tenants`, `usuarios`, `productos`, `clientes`
- Campos: `is_deleted` (BOOLEAN), `deleted_at` (TIMESTAMPTZ)
- Beneficio: Auditoría completa, recuperación de datos

🔥 **Config JSON Flexible:**
- Campo `config_json` en `tenants`
- Permite configuraciones únicas por lomitería
- Ejemplo: `{"modulos": {"kds": true}, "tema": "dark"}`

🔥 **Multi-Tenant Completo:**
- `tenant_id` agregado a `movimientos_inventario` y `transacciones_puntos`
- Mejora queries y facilita RLS

🔥 **Índices Optimizados:**
- Todos los índices de búsqueda filtran `WHERE is_deleted = false`
- Queries más rápidas, menor uso de espacio

🔥 **Numeración Segura por Tenant:**
- Tabla `tenant_pedido_counters` + trigger `trigger_asignar_numero_pedido`
- Garantiza números correlativos incluso con múltiples cajas

🔥 **Pedidos Instantáneos:**
- El campo `estado` ahora parte como `entregado`
- Alineado con el flujo actual donde cobrar = pedido completado

🔥 **Seeds Robustos:**
- Usan `slug` en vez de IDs hardcodeados
- Más confiables al regenerar base de datos

---

## 🆘 **Troubleshooting**

### ❌ Error: "relation already exists"
✅ **Solución:** Normal si re-ejecutás el script. Todas las tablas usan `IF NOT EXISTS`.

### ❌ Error: "permission denied"
✅ **Solución:** Necesitás permisos de admin en Supabase. Verificá que estés logueado como owner del proyecto.

### ❌ Error: "tenant not found" al ejecutar atlas-burger.sql
✅ **Solución:** Primero ejecutá `00_initial_schema.sql` para crear el tenant base.

### ❓ ¿Cómo agregar una nueva lomitería?

```sql
-- 1. Crear el tenant
INSERT INTO tenants (nombre, slug, telefono, email)
VALUES ('Lomitería Nueva', 'lomiteria-nueva', '+595123456789', 'contacto@nueva.com');

-- 2. Crear un usuario admin
INSERT INTO usuarios (tenant_id, email, nombre, rol)
VALUES (
  (SELECT id FROM tenants WHERE slug = 'lomiteria-nueva'),
  'admin@nueva.com',
  'Admin Nueva',
  'admin'
);

-- 3. Cargar productos, categorías, ingredientes, etc.
```

### 🗑️ ¿Cómo usar Soft Delete?

**Eliminar (soft delete):**
```sql
-- Eliminar un producto (mantiene historial)
UPDATE productos 
SET is_deleted = true, deleted_at = NOW() 
WHERE id = 'producto-uuid';

-- Eliminar un cliente (mantiene puntos y transacciones)
UPDATE clientes 
SET is_deleted = true, deleted_at = NOW() 
WHERE id = 'cliente-uuid';
```

**Recuperar:**
```sql
-- Restaurar un producto eliminado
UPDATE productos 
SET is_deleted = false, deleted_at = NULL 
WHERE id = 'producto-uuid';
```

**Listar eliminados:**
```sql
-- Ver todos los productos eliminados
SELECT * FROM productos 
WHERE is_deleted = true 
ORDER BY deleted_at DESC;
```

**Purgar definitivamente (usar con cuidado):**
```sql
-- Eliminar PERMANENTEMENTE registros eliminados hace más de 1 año
DELETE FROM productos 
WHERE is_deleted = true 
  AND deleted_at < NOW() - INTERVAL '1 year';
```

---

## 🖨️ **Reimpresión cocina / factura (cola Realtime)**

Ejecutá **`14_reprint_solicitud.sql`** y **`15_bump_factura_reprint_solicitud.sql`** (si usás RPC `bump_factura_reprint`). El agente debe escuchar **INSERT** en `reprint_solicitud` y ramificar por `tipo`. Ver **`docs/AGENTE_REPRINT_SOLICITUD.md`**. Emisión inicial: **dos** copias de factura en el listener de pedidos; reimpresión: **una** copia por `reprint_solicitud` — **`docs/AGENTE_FACTURA_EMISION_DOS_COPIAS.md`**.

---

## 🔒 **Seguridad (RLS)**

Por ahora, **RLS está deshabilitado** para facilitar el desarrollo.

Cuando estés listo para producción:
1. Ejecutar `01_migration_escalabilidad.sql`
2. Habilitar RLS en todas las tablas
3. Las políticas ya están definidas en el script

---

## 📚 **Recursos Adicionales**

- [Documentación Supabase](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Multi-Tenant Best Practices](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## ✅ **Checklist de Setup**

- [ ] Proyecto creado en Supabase
- [ ] `00_initial_schema.sql` ejecutado
- [ ] `atlas-burger.sql` ejecutado
- [ ] Variables de entorno configuradas en `.env.local`
- [ ] Servidor Next.js levantado
- [ ] Login funcionando
- [ ] POS funcionando
- [ ] Admin dashboard funcionando

---

**¿Dudas?** Revisá los comentarios dentro de cada archivo SQL. Están super documentados! 📖
