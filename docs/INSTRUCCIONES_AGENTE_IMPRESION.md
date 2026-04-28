# 📋 Instrucciones para el Agente de Impresión

## 🎯 Contexto del Proyecto

Estamos implementando un sistema POS (Point of Sale) para lomiterías (restaurantes de hamburguesas) llamado **Ka'u Manager**. El sistema es multi-tenant (soporta múltiples lomiterías independientes) y está construido con:

- **Frontend:** Next.js 15 (React + TypeScript)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Arquitectura:** Feature-based (modular)

## ✅ Lo que ya está implementado

### 1. Base de Datos
- ✅ Tabla `printer_config` creada en Supabase
- ✅ Configuración para conectar cada lomitería con su impresora física
- ✅ Vista `vista_printer_config` para verificar configuración

### 2. Servicio de Impresión en la App Web
- ✅ Servicio `printService.ts` que:
  - Consulta la configuración de impresora desde Supabase
  - Envía órdenes de impresión al agente local
  - Maneja errores sin afectar el guardado del pedido

### 3. Integración en el Flujo de Pedidos
- ✅ Cuando un usuario confirma un pedido en el POS, automáticamente se intenta imprimir el ticket de cocina
- ✅ La impresión es **no crítica**: si falla, el pedido se guarda igual

### 3b. Realtime y factura (emisión vs reimpresión)

En el flujo **Realtime** (agente escuchando Supabase), no solo HTTP:

- **Emisión inicial** (pedido en `FACT` con factura emitida): además del ticket de cocina, la factura debe imprimirse **dos veces** (entrega al cliente y archivo del local). Ver especificación: [`AGENTE_FACTURA_EMISION_DOS_COPIAS.md`](AGENTE_FACTURA_EMISION_DOS_COPIAS.md).
- **Reimpresión** desde la app: un `INSERT` en `reprint_solicitud` con `tipo = 'factura'` implica **una sola** copia. Ver [`AGENTE_REPRINT_SOLICITUD.md`](AGENTE_REPRINT_SOLICITUD.md).

### 3c. Emisión inicial: `UPDATE` de `pedidos` (EDIT → FACT), no solo `INSERT`

El POS crea el pedido con `estado_pedido = 'EDIT'` y, cuando ya están guardados los ítems, la customización en BD (`items_pedido_customizacion`) y la factura (si corresponde), hace **un único** `UPDATE` a `estado_pedido = 'FACT'`. Así la vista `vista_items_ticket_cocina` y la factura están listas cuando dispara Realtime.

**Requisito para el agente:** en `public.pedidos`, suscribirse a **`postgres_changes` con `event: '*'`** (o al menos incluir **`UPDATE`**, no solo `INSERT`). Tratar **emisión inicial** cuando el registro pasa a `FACT`, por ejemplo:

- `payload.eventType === 'UPDATE'` y `new.estado_pedido === 'FACT'` y `old.estado_pedido !== 'FACT'`, o
- equivalente según el SDK.

Evitar imprimir dos veces la misma emisión si también reaccionás a otros campos del mismo `UPDATE`. La **reimpresión** sigue siendo solo vía `reprint_solicitud`.

Guía autocontenida para el repo del agente: [`AGENTE_AJUSTE_EMISION_EDIT_A_FACT.md`](AGENTE_AJUSTE_EMISION_EDIT_A_FACT.md).

### 3d. Regla especial para Mesas (cocina inmediata, factura diferida)

Para pedidos con `mesa_id`:

- En emisión inicial (`EDIT -> FACT`): imprimir **solo cocina**.
- En ese flujo no se muestra el resumen normal de confirmación en POS; la cuenta queda abierta en la mesa.
- La factura se difiere a la acción "Imprimir cuenta / Cerrar cuenta".
- Karubox crea la fila en `facturas` y luego encola `reprint_solicitud` con `tipo = 'factura'`.
- En esa cola, cada `INSERT` de factura imprime **una sola** copia.
- El cierre de cuenta se puede disparar desde POS (modo mesa) o desde el panel Mesas; al completarse, la mesa queda en `libre`.

Contrato completo: [`CONTRATO_MESAS_IMPRESION_OPERATIVO.md`](CONTRATO_MESAS_IMPRESION_OPERATIVO.md).

## 📡 Formato de Request que Envía la App Web

La app web envía un `POST` a tu agente en:

```
POST http://192.168.100.2:3001/print
Content-Type: application/json
```

### Estructura del Body:

```json
{
  "printerId": "atlas-burger-printer-1",
  "tipo": "cocina",
  "data": {
    "numeroPedido": 123,
    "tipoPedido": "local",
    "lomiteriaNombre": "Atlas Burger",
    "items": [
      {
        "nombre": "Hamburguesa Clásica",
        "cantidad": 2,
        "personalizaciones": "+Queso, +Bacon | SIN: Cebolla",
        "notasItem": null
      }
    ],
    "cliente": null,
    "fecha": "2024-12-XXT10:30:00.000Z",
    "notas": "Sin cebolla, bien cocida"
  }
}
```

**Nota:** Para tickets de cocina, se eliminan precios y totales (no son relevantes para el cocinero). Solo se incluyen:
- Número de pedido (grande y visible)
- Tipo de pedido
- Items con cantidad y personalizaciones
- Cliente solo si es delivery (necesita dirección)

### Campos del Request:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `printerId` | string | ID de la impresora configurada en tu agente (debe coincidir con `printer_id` en la BD) |
| `tipo` | string | Tipo de ticket: `"cocina"` o `"cliente"` |
| `data.numeroPedido` | number | Número de pedido (correlativo por lomitería) - **IMPORTANTE: Mostrar GRANDE** |
| `data.tipoPedido` | string | `"local"`, `"delivery"` o `"para_llevar"` |
| `data.lomiteriaNombre` | string | Nombre de la lomitería |
| `data.items[]` | array | Array de items del pedido |
| `data.items[].nombre` | string | Nombre del producto |
| `data.items[].cantidad` | number | Cantidad a preparar |
| `data.items[].personalizaciones` | string \| null | Formateado como texto: `"+Queso, +Bacon \| SIN: Cebolla"` |
| `data.items[].notasItem` | string \| null | Notas específicas del item |
| `data.cliente` | object \| null | Solo para delivery: nombre, teléfono, dirección |
| `data.fecha` | string | ISO 8601 timestamp |
| `data.notas` | string \| null | Notas generales del pedido |

**⚠️ IMPORTANTE para tickets de cocina:**
- **NO incluir precios** (no son relevantes para el cocinero)
- **NO incluir totales** (no son relevantes para el cocinero)
- **Número de pedido debe ser GRANDE y visible**
- **Personalizaciones formateadas como texto legible**

## 🔧 Lo que Necesita el Agente

### 1. Configurar la Impresora en el Agente (PASO CRÍTICO)

**⚠️ ANTES de poder imprimir, debes configurar la impresora física en el agente.**

El agente tiene un endpoint para configurar impresoras:

**Endpoint:** `POST http://[agent_ip]:[agent_port]/api/printer/configure`

**Body:**
```json
{
  "printerId": "atlas-burger-printer-1",
  "name": "Impresora Térmica Cocina",
  "connectionType": "usb",
  "path": "COM3"  // O la ruta USB de tu impresora (ej: "USB001" o "/dev/usb/lp0" en Linux)
}
```

**Ejemplo con curl:**
```bash
curl -X POST http://192.168.100.2:3001/api/printer/configure \
  -H "Content-Type: application/json" \
  -d '{
    "printerId": "atlas-burger-printer-1",
    "name": "Impresora Térmica Cocina",
    "connectionType": "usb",
    "path": "COM3"
  }'
```

**Para encontrar la ruta de tu impresora:**
- **Windows:** Abre "Dispositivos e impresoras" → Click derecho en la impresora → "Propiedades de impresora" → Pestaña "Puertos" → Busca "COM3", "COM4", etc.
- **Linux:** Usa `lpstat -p` o `lsusb` para encontrar el dispositivo

**El `printerId` debe coincidir exactamente** con el que está en la base de datos (`printer_config.printer_id`).

### 2. Endpoint `/print`
- **Método:** `POST`
- **Content-Type:** `application/json`
- **Puerto:** `3001` (o el que configures)
- **IP:** `192.168.100.2` (IP local de la PC donde corre el agente)

### 3. Formato de Respuesta Esperado

**Éxito:**
```json
{
  "success": true,
  "message": "Ticket impreso correctamente"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Descripción del error"
}
```

### 4. Manejo de Errores
- Si la impresora no está disponible, retornar error pero no lanzar excepción
- Si el `printerId` no existe, retornar error
- Si hay problemas de conexión con la impresora, retornar error descriptivo

## 📝 Formato del Ticket de Cocina

**El ticket debe ser GRANDE, CLARO y SIMPLE.** Solo lo esencial para cocinar:

1. **Encabezado (GRANDE):**
   - **NÚMERO DE PEDIDO** (muy grande y visible)
   - Tipo de pedido (Local / Delivery / Para Llevar)
   - Fecha y hora

2. **Items (ordenados y claros):**
   - Cantidad × Nombre del producto
   - Personalizaciones (si hay): `+Queso, +Bacon | SIN: Cebolla`
   - Notas del item (si hay)

3. **Pie (solo si es necesario):**
   - Notas generales del pedido (si hay)
   - Datos del cliente (solo si es delivery: nombre, teléfono, dirección)

**❌ NO incluir:**
- Precios
- Totales
- Información del cliente (excepto delivery)
- Descripciones largas

## 🔄 Flujo Completo

```
1. Usuario en el POS confirma un pedido
   ↓
2. App web guarda el pedido en Supabase
   ↓
3. App web consulta printer_config por lomiteria_id
   ↓
4. App web obtiene:
   - agent_ip: "192.168.100.2"
   - agent_port: 3001
   - printer_id: "atlas-burger-printer-1"
   ↓
5. App web envía POST a http://192.168.100.2:3001/print
   ↓
6. Tu agente recibe el request
   ↓
7. Tu agente busca la impresora por printerId
   ↓
8. Tu agente formatea e imprime el ticket
   ↓
9. Tu agente retorna { success: true }
```

## ⚙️ Configuración Actual en la Base de Datos

```sql
-- Configuración para Atlas Burger
SELECT * FROM vista_printer_config WHERE lomiteria_slug = 'atlas-burger';
```

Resultado esperado:
- `agent_ip`: `192.168.100.2`
- `agent_port`: `3001`
- `printer_id`: `atlas-burger-printer-1`
- `agent_url`: `http://192.168.100.2:3001/print`

## 🧪 Testing

Para probar, puedes usar:

```bash
curl -X POST http://192.168.100.2:3001/print \
  -H "Content-Type: application/json" \
  -d '{
    "printerId": "atlas-burger-printer-1",
    "tipo": "cocina",
    "data": {
      "numeroPedido": 1,
      "tipoPedido": "local",
      "items": [
        {
          "nombre": "Hamburguesa Clásica",
          "cantidad": 1,
          "precio_unitario": 25000,
          "subtotal": 25000
        }
      ],
      "total": 25000,
      "cliente": null,
      "fecha": "2024-12-XXT10:30:00.000Z",
      "notas": null
    }
  }'
```

## 📚 Documentación Adicional

- **Arquitectura completa:** Ver `docs/ARQUITECTURA_IMPRESION.md`
- **Script SQL:** Ver `database/02_printer_config.sql`
- **Código del servicio:** Ver `src/features/pos/services/printService.ts`

## ✅ Checklist para el Agente

- [ ] **PASO 1:** Impresora física configurada usando `POST /api/printer/configure`
- [ ] **PASO 2:** Verificar que la impresora esté conectada y funcionando
- [ ] **PASO 3:** Endpoint `/print` implementado y funcionando
- [ ] Impresora configurada con ID `"atlas-burger-printer-1"` (debe coincidir con BD)
- [ ] Agente corriendo en `http://192.168.100.2:3001`
- [ ] Formato de respuesta JSON implementado
- [ ] Manejo de errores implementado
- [ ] Formato de ticket de cocina definido
- [ ] Testing con curl exitoso

## 🚨 Error Común: "Impresora no encontrada"

Si recibes el error:
```
"Impresora atlas-burger-printer-1 no encontrada. Configúrala primero usando POST /api/printer/configure"
```

**Solución:**
1. Configura la impresora usando el endpoint `/api/printer/configure` (ver arriba)
2. Verifica que el `printerId` coincida exactamente con el de la BD
3. Asegúrate de que la impresora esté conectada y encendida

---

**¿Dudas?** El servicio de impresión en la app web ya está listo y funcionando. Solo necesita que el agente esté corriendo y respondiendo correctamente.

