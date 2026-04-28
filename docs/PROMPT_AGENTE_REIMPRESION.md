# Prompt para el agente de impresión — reimpresión (Realtime)

Copiá el bloque de abajo y pegalo en el repo del agente o en Cursor / otro asistente que vaya a modificar el listener.

---

## Texto del prompt (copiar desde aquí)

```
Contexto: POS multi-tenant (Supabase). El agente escucha Realtime y lee pedidos/facturas/vistas en PostgreSQL.

REIMPRESIÓN (cocina y factura) — misma tabla, distinto tipo:
- La app NO usa UPDATE en pedidos ni en facturas para reimprimir.
- Hace INSERT en public.reprint_solicitud con:
  - tenant_id (uuid del local)
  - pedido_id (uuid)
  - tipo = 'cocina' | 'factura' (check constraint)
  - created_at (default now)
  - id (uuid PK)
- La BD valida: pedido FACT del tenant; si tipo = 'factura', debe existir factura activa (no anulada).

LO QUE TENÉS QUE HACER EN EL AGENTE:
1) Suscribirte a Supabase Realtime: postgres_changes, event INSERT, schema public, table reprint_solicitud.
2) Filtrar por el tenant_id de esta instalación (igual que con pedidos).
3) Si tipo === 'cocina':
   - Imprimí SOLO ticket de cocina (vista_items_ticket_cocina, pedido, tenants, clientes si aplica). NO imprimas factura en este evento.
4) Si tipo === 'factura':
   - Imprimí SOLO factura (vista_factura_impresion o equivalente por pedido_id). NO imprimas ticket de cocina en este evento.
5) Deduplicación: cada fila tiene id único (reprint_solicitud.id).

REQUISITOS EN SUPABASE:
- Migración 14_reprint_solicitud.sql aplicada; Realtime habilitado para reprint_solicitud.
- Si usás RPC bump_factura_reprint desde la app, ejecutá también 15_bump_factura_reprint_solicitud.sql para que encole en reprint_solicitud.

CONTRATO DE IMPRESIÓN:
- Cocina: mismo formato interno que ya usás (printerId desde printer_config, data con numeroPedido, items, etc. — ver INSTRUCCIONES_AGENTE_IMPRESION en este repo).
- Factura: mismo pipeline que al emitir factura la primera vez (timbrado, ítems, totales IVA).

EMISIÓN INICIAL (listener de pedido FACT — NO es reprint_solicitud):
- El POS hace INSERT del pedido con estado_pedido EDIT y luego UPDATE a FACT cuando ya están ítems + items_pedido_customizacion + factura (si aplica). Suscribite a pedidos con event INSERT+UPDATE (o '*'), y dispará emisión inicial en UPDATE cuando new.estado_pedido === 'FACT' y antes no lo estaba (evitar doble impresión).
- Si el pedido tiene mesa_id: en emisión inicial imprimí SOLO cocina (factura diferida).
- Si el pedido NO tiene mesa_id, existe factura para ese pedido_id (vista_factura_impresion / tabla facturas) y `ENABLE_INVOICE_PRINTING=true`, además de cocina: imprimí la factura **DOS veces** (copia cliente + copia local/archivo). Mismo contenido o con leyenda opcional en cada copia.
- Si NO hay factura (ej. canje de puntos): solo cocina, **cero** facturas.
- Reimpresión (reprint_solicitud) NO debe duplicar: ahí va **una** factura por INSERT (incluye cierre de cuenta de mesa).

RESUMEN:
Sin manejar ambos tipos en el listener de reprint_solicitud, la reimpresión desde la app no imprimirá lo esperado.
Especificación detallada emisión 2 copias: docs/AGENTE_FACTURA_EMISION_DOS_COPIAS.md en este repo.
Contrato mesas: docs/CONTRATO_MESAS_IMPRESION_OPERATIVO.md en este repo.
```

---

## Referencias en este repo

- Emisión inicial 2× factura vs reimpresión 1×: [`AGENTE_FACTURA_EMISION_DOS_COPIAS.md`](AGENTE_FACTURA_EMISION_DOS_COPIAS.md)
- Tabla + trigger: [`database/14_reprint_solicitud.sql`](../database/14_reprint_solicitud.sql)
- RPC factura alineado a cola: [`database/15_bump_factura_reprint_solicitud.sql`](../database/15_bump_factura_reprint_solicitud.sql)
- Resumen: [`AGENTE_REPRINT_SOLICITUD.md`](AGENTE_REPRINT_SOLICITUD.md)
- Formato ticket cocina: [`INSTRUCCIONES_AGENTE_IMPRESION.md`](INSTRUCCIONES_AGENTE_IMPRESION.md)
