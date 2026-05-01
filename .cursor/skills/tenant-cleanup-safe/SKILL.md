---
name: tenant-cleanup-safe
description: Ejecuta limpiezas transaccionales seguras por tenant en Supabase/Postgres, preservando usuarios y catálogos de productos/materias primas. Usar cuando el usuario pida limpiar datos de pruebas de pedidos, caja, mesas, facturas o movimientos operativos antes de salida a producción.
disable-model-invocation: true
---

# Tenant Cleanup Safe

## Objetivo

Preparar y ejecutar (solo con aprobación explícita) una limpieza de datos transaccionales de un tenant, con riesgo mínimo y trazabilidad completa.

## Principios obligatorios

1. Nunca borrar datos fuera del `tenant_id` objetivo.
2. Nunca borrar usuarios del tenant (`usuarios`) salvo pedido explícito.
3. Nunca borrar catálogo de productos/categorías/ingredientes salvo pedido explícito.
4. Siempre hacer precheck y postcheck con conteos.
5. Si hay duda de alcance, detener y pedir confirmación antes de generar DELETE.
6. Ejecutar limpieza en transacción (`BEGIN ... COMMIT`) y con orden FK seguro (hijo -> padre).

## Descubrimiento mínimo (solo lectura)

Antes de proponer script:

1. Identificar proyecto Supabase y confirmar `tenant_id`.
2. Listar tablas con columna `tenant_id`.
3. Obtener relaciones FK relevantes para tablas operativas.
4. Medir volumen por tabla (conteos del tenant).
5. Detectar tablas sin `tenant_id` que deban filtrarse por `pedido_id`/relación indirecta (ej. `items_pedido`, `items_pedido_customizacion`, `print_trace_events`).
6. Confirmar decisiones de negocio antes de limpiar:
   - correlativos (`tenant_pedido_counters`, `tenant_facturacion.ultimo_numero`);
   - stock (`ingredientes.stock_actual`);
   - clientes y puntos (`clientes`, `transacciones_puntos`).

## Alcance típico de limpieza (NO catálogo)

Incluye normalmente:

- `items_pedido_customizacion`
- `items_pedido`
- `facturas`
- `pedido_divisiones`
- `reprint_solicitud`
- `movimientos_ingredientes`
- `movimientos_inventario`
- `transacciones_puntos`
- `mesa_eventos`
- `pedidos`
- `mesa_union_items`
- `mesa_uniones`
- `mesa_reservas`
- `sesiones_caja`
- `print_trace_events` (filtrado por `order_id` de pedidos del tenant)

No incluir por defecto:

- `usuarios`
- `categorias`
- `productos`
- `ingredientes` (catálogo)
- `recetas_producto`

## Orden seguro de borrado

Usar este orden base (adaptar por FK reales):

1. Hijos de `items_pedido` y `pedidos`.
2. Registros dependientes de `pedidos` (`facturas`, `reprint_solicitud`, `movimientos_*`, etc.).
3. `pedidos`.
4. Estructuras operativas de mesas (`mesa_union_items` -> `mesa_uniones` -> `mesa_reservas`).
5. `sesiones_caja`.
6. Trazas sin FK (`print_trace_events`) filtradas por pedidos del tenant.
7. Reseteos confirmados (correlativos, stock).

## Entregables obligatorios

Generar dos scripts SQL:

1. `*_precheck_*.sql`
   - Conteos por tabla objetivo.
   - Snapshot de correlativos/stock.
   - Validación de alcance.

2. `*_cleanup_*.sql`
   - `BEGIN`/`COMMIT`.
   - CTE de tenant objetivo.
   - Deletes en orden FK seguro.
   - Updates de reseteo solo si fueron aprobados.
   - Bloque final de verificación.

## Plantilla base de precheck

```sql
-- Reemplazar solo este valor
with tenant_target as (
  select 'TENANT_UUID_AQUI'::uuid as tenant_id
)
select 'pedidos' as tabla, count(*) as filas
from public.pedidos p
join tenant_target t on p.tenant_id = t.tenant_id
union all
select 'facturas', count(*)
from public.facturas f
join tenant_target t on f.tenant_id = t.tenant_id;
```

## Plantilla base de cleanup

```sql
begin;

with tenant_target as (
  select 'TENANT_UUID_AQUI'::uuid as tenant_id
),
tenant_orders as (
  select p.id
  from public.pedidos p
  join tenant_target t on p.tenant_id = t.tenant_id
),
tenant_items as (
  select i.id
  from public.items_pedido i
  join tenant_orders o on o.id = i.pedido_id
)
delete from public.items_pedido_customizacion c
where c.item_pedido_id in (select id from tenant_items);

-- ... resto de deletes en orden seguro ...

-- Reseteos opcionales (solo si aprobados):
-- update public.tenant_pedido_counters set ultimo_numero = 0 where tenant_id = (select tenant_id from tenant_target);
-- update public.tenant_facturacion set ultimo_numero = 0 where tenant_id = (select tenant_id from tenant_target);
-- update public.ingredientes set stock_actual = 0 where tenant_id = (select tenant_id from tenant_target);

commit;
```

## Checklist final antes de ejecutar

- `tenant_id` validado 2 veces.
- Confirmado por usuario qué NO se toca.
- Confirmado por usuario qué reseteos sí aplicar.
- Precheck ejecutado y revisado.
- Script incluye filtros por tenant en todas las sentencias.
- Script incluye postcheck de verificación.

## Regla de oro

Si algo no está explícitamente autorizado, no se borra.
