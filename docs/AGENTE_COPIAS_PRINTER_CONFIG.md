# Agente: copias desde `printer_config` (admin del local)

La web guarda en **`public.printer_config`** (por `lomiteria_id` = `tenant_id`):

| Columna | Valores | Quién lo edita |
|---------|---------|----------------|
| `copias_ticket_cocina` | 1 o 2 | Admin → `/home/configuracion` |
| `copias_factura_cierre` | 1 o 2 | Admin → `/home/configuracion` |

Migraciones: `database/32_printer_config_copias.sql`, permisos/RLS: `database/33_printer_config_rls_tenant.sql`.

### Comportamiento en la web (Lomiteria1.0)

Sin cambiar el agente, la app **encola trabajos extra** por el **mismo canal** que “Reimprimir” (`INSERT` en `reprint_solicitud`):

- **Cocina:** al pasar el pedido a `FACT`, si `copias_ticket_cocina = 2`, se encola **una** solicitud extra `tipo = cocina` tras ~450 ms (el agente ya imprime la primera al listener de `FACT`).
- **Factura / cierre mesa:** al cerrar cuenta, si `copias_factura_cierre = 2`, se hacen **dos** `INSERT` tipo `factura` seguidos para el mismo pedido.

El agente sigue imprimiendo **una copia por cada INSERT** (como ya hace en Reimprimir).

Si los switches están en doble y **aún** sale una sola copia: revisá que exista fila en `printer_config`, migraciones **32/33**, permisos RLS, y que **Reimprimir** desde el POS sí imprima para ese local.

---

## Qué puede hacer el agente (opcional, optimización)

Si preferís no depender de inserts duplicados desde la web, el agente puede leer las columnas y repetir el trabajo en un solo evento:

1. **Al preparar cualquier impresión**, cargar una vez la fila de `printer_config` para el `tenant_id` del evento (la misma consulta que ya usás para `printer_id` / impresora).

2. **Ticket de cocina — emisión inicial** (pedido pasa a `FACT`, listener de `pedidos`):
   - Imprimir el ticket de cocina **`copias_ticket_cocina` veces** (1 o 2).
   - Si el valor falta en BD o es NULL, usar **1**.

3. **Factura — `reprint_solicitud` con `tipo = 'factura'`** (cierre de mesa, reimpresión POS, etc.):
   - **Opción A (recomendada hoy):** la web ya puede enviar **N inserts** (mismo `pedido_id`) si `copias_factura_cierre = 2` → el agente imprime **una vez por insert** (igual que Reimprimir).
   - **Opción B:** un solo `INSERT` y el agente lee `copias_factura_cierre` e imprime N veces (sin duplicar filas en la cola).

4. **Emisión inicial con factura en mostrador** (sin mesa, `EDIT → FACT` con factura):
   - Seguir la regla de negocio ya definida en [`AGENTE_FACTURA_EMISION_DOS_COPIAS.md`](AGENTE_FACTURA_EMISION_DOS_COPIAS.md) (típicamente 2 copias fiscales cliente/archivo), salvo que el producto pida alinear también con `copias_factura_cierre`. **No mezclar** esa ruta con “copias de cierre” sin definición explícita.

5. **Pedidos con mesa** en confirmación: solo cocina en esa fase; la factura al cerrar cuenta usa el punto 3.

---

## Verificación rápida en Supabase

```sql
SELECT lomiteria_id, copias_ticket_cocina, copias_factura_cierre, updated_at
FROM public.printer_config
WHERE lomiteria_id = '<uuid del local>';
```

Si la web encola **dos** `reprint_solicitud` (cierre con doble factura) y en papel sale una sola, el fallo está en el **agente** o en la cola (Realtime). Si **Reimprimir** dos veces seguidas desde el POS tampoco da dos hojas, el problema no es la app.

---

## Referencias

- Reimpresión: [`AGENTE_REPRINT_SOLICITUD.md`](AGENTE_REPRINT_SOLICITUD.md)
- Dos copias emisión inicial factura: [`AGENTE_FACTURA_EMISION_DOS_COPIAS.md`](AGENTE_FACTURA_EMISION_DOS_COPIAS.md)
