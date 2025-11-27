# Arquitectura del Proyecto - Ka'u Manager

## 📐 Estructura General

El proyecto utiliza una **arquitectura feature-based** (basada en características), organizando el código por funcionalidades de negocio en lugar de por tipo de archivo. Esto facilita el mantenimiento, la escalabilidad y la colaboración en equipos.

```
pos-lomiteria/
├── src/
│   ├── app/                    # Next.js App Router (páginas y rutas)
│   ├── features/               # Módulos de negocio (features)
│   ├── shared/                 # Código compartido entre features
│   ├── core/                   # Infraestructura base
│   └── lib/                    # Utilidades legacy (en proceso de migración)
```

---

## 🎯 Capas de la Arquitectura

### 1. **`src/app/`** - Capa de Presentación (Next.js App Router)

Contiene las páginas y rutas de la aplicación. Esta capa es delgada y solo orquesta los componentes de las features.

```
app/
├── layout.tsx                  # Layout raíz con TenantProvider y AppFrame
├── page.tsx                    # Página de inicio
├── globals.css                 # Estilos globales
├── login/
│   └── page.tsx                # Página de login
├── (admin)/                    # Grupo de rutas admin
│   └── admin/
│       ├── page.tsx            # Dashboard principal
│       └── clientes/
│           └── page.tsx        # Gestión de clientes
├── (pos)/                      # Grupo de rutas POS
│   └── pos/
│       └── page.tsx            # Punto de venta
└── (kds)/                      # Grupo de rutas KDS
    └── kds/
        └── page.tsx            # Pantalla de cocina
```

**Principios:**
- Las páginas importan componentes y servicios desde `features/`
- No contiene lógica de negocio
- Usa componentes de `shared/` para UI común

---

### 2. **`src/features/`** - Capa de Dominio (Features)

Cada feature es un módulo autocontenido que agrupa todo lo relacionado con una funcionalidad de negocio.

#### Estructura de una Feature

```
features/
└── [feature-name]/
    ├── index.ts                # Barrel export (punto de entrada público)
    ├── [feature].service.ts    # Lógica de negocio y llamadas a API
    ├── [feature].types.ts      # Tipos TypeScript específicos
    ├── components/             # Componentes React específicos de la feature
    │   └── [Component].tsx
    └── [otros archivos]        # Stores, hooks, utils específicos
```

#### Features Actuales

##### 🔐 **`features/auth/`** - Autenticación y Multi-tenant
```
auth/
├── index.ts                    # Exporta TenantProvider, useTenant, tipos
└── TenantContext.tsx           # Contexto React para tenant y usuario
```

**Responsabilidades:**
- Gestión de sesión de usuario
- Contexto de tenant activo
- Autenticación con Supabase
- Cambio de tema (dark mode)

---

##### 👥 **`features/clientes/`** - Gestión de Clientes
```
clientes/
├── index.ts                    # Barrel export
├── clientes.service.ts         # CRUD de clientes
├── puntos.service.ts           # Gestión de puntos de fidelidad
└── components/
    └── ClientModal.tsx         # Modal para crear/editar clientes
```

**Responsabilidades:**
- CRUD de clientes
- Sistema de puntos de fidelidad
- Historial de pedidos por cliente

---

##### 📦 **`features/productos/`** - Catálogo de Productos
```
productos/
├── index.ts                    # Barrel export
├── productos.service.ts         # CRUD de productos
├── categorias.service.ts       # CRUD de categorías
├── promociones.service.ts      # Gestión de promociones
└── components/
    ├── CategoryList.tsx        # Lista de categorías
    └── ProductGrid.tsx        # Grid de productos
```

**Responsabilidades:**
- Catálogo de productos
- Categorías
- Promociones y descuentos

---

##### 🛒 **`features/pedidos/`** - Gestión de Pedidos
```
pedidos/
├── index.ts                    # Barrel export
├── pedidos.service.ts          # CRUD de pedidos
├── cartStore.ts                # Zustand store para carrito
└── components/
    └── Cart.tsx                # Componente de carrito
```

**Responsabilidades:**
- Creación y gestión de pedidos
- Estado del carrito (Zustand)
- Cálculo de totales y puntos

---

##### 🥙 **`features/ingredientes/`** - Gestión de Ingredientes
```
ingredientes/
├── index.ts                    # Barrel export
├── ingredients.service.ts      # CRUD de ingredientes
├── ingredients.types.ts        # Tipos de ingredientes y recetas
└── components/
    └── ItemCustomizationDrawer.tsx  # Editor de personalización
```

**Responsabilidades:**
- Catálogo de ingredientes
- Recetas de productos
- Personalización de items

---

##### 📊 **`features/inventario/`** - Control de Inventario
```
inventario/
├── index.ts                    # Barrel export
├── consumption.service.ts      # Lógica de consumo automático
└── components/
    └── InventoryDrawer.tsx     # Drawer para ajustar inventario
```

**Responsabilidades:**
- Control de stock
- Consumo automático al vender
- Alertas de stock mínimo

---

##### 📈 **`features/dashboard/`** - Dashboard y KPIs
```
dashboard/
├── index.ts                    # Barrel export
└── components/
    └── KpiCard.tsx            # Tarjeta de KPI reutilizable
```

**Responsabilidades:**
- Componentes de visualización de métricas
- KPIs y gráficos

---

### 3. **`src/shared/`** - Código Compartido

Contiene código reutilizable entre múltiples features.

```
shared/
├── index.ts                    # Barrel export principal
├── components/                  # Componentes UI compartidos
│   ├── layout/
│   │   ├── AppFrame.tsx        # Frame global con navbar
│   │   └── AppNavbar.tsx        # Barra de navegación global
│   └── ui/
│       └── FeedbackModal.tsx    # Modal de éxito/error
├── types/                      # Tipos TypeScript compartidos
│   ├── supabase.ts            # Tipos generados de Supabase
│   └── database.ts            # Tipos adicionales (legacy)
└── utils/                      # Utilidades compartidas
    ├── format.ts              # Formateo de números, moneda, etc.
    └── utils.ts               # Utilidades generales (cn, etc.)
```

**Principios:**
- Solo código usado por 2+ features
- No debe depender de ninguna feature específica
- Puede depender de `core/`

---

### 4. **`src/core/`** - Infraestructura Base

Configuración y servicios fundamentales del sistema.

```
core/
├── index.ts                    # Barrel export
└── supabase.ts                 # Cliente de Supabase configurado
```

**Responsabilidades:**
- Configuración de Supabase
- Clientes de servicios externos
- Configuración base de la app

---

### 5. **`src/lib/`** - Legacy (En Migración)

Código antiguo que se está migrando gradualmente a la nueva arquitectura.

```
lib/
└── db/
    └── index.ts               # Re-exporta servicios (legacy)
```

---

## 🔗 Path Aliases (TypeScript)

Configurados en `tsconfig.json`:

```json
{
  "@/*": ["./src/*"],
  "@/features/*": ["./src/features/*"],
  "@/shared/*": ["./src/shared/*"],
  "@/core/*": ["./src/core/*"]
}
```

**Uso:**
```typescript
// ✅ Correcto
import { useTenant } from '@/features/auth'
import { formatGuaranies } from '@/shared/utils/format'
import { supabase } from '@/core/supabase'

// ❌ Incorrecto (rutas relativas largas)
import { useTenant } from '../../../features/auth'
```

---

## 📦 Barrel Exports (index.ts)

Cada feature y módulo tiene un `index.ts` que actúa como punto de entrada público:

```typescript
// features/productos/index.ts
export * from './productos.service'
export * from './categorias.service'
export { default as CategoryList } from './components/CategoryList'
```

**Ventajas:**
- Imports más limpios: `import { ... } from '@/features/productos'`
- Encapsulación: solo se exporta lo público
- Facilita refactorización interna

---

## 🎨 Estilos (Tailwind CSS)

Configuración en `tailwind.config.ts`:

```typescript
content: [
  "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/features/**/*.{js,ts,jsx,tsx,mdx}",  // ✅ Nuevas rutas
  "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/core/**/*.{js,ts,jsx,tsx,mdx}",
]
```

---

## 🔄 Flujo de Datos

```
┌─────────────────┐
│   app/page.tsx   │  ← Capa de presentación
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  features/*/    │  ← Lógica de negocio
│  components/    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  features/*/    │  ← Servicios (API calls)
│  *.service.ts   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  core/supabase  │  ← Infraestructura
└─────────────────┘
```

---

## 📋 Reglas de Importación

### ✅ **Correcto:**
```typescript
// Desde features
import { useTenant } from '@/features/auth'
import { getProductos } from '@/features/productos'

// Desde shared
import { formatGuaranies } from '@/shared/utils/format'
import { AppFrame } from '@/shared'

// Desde core
import { supabase } from '@/core/supabase'
```

### ❌ **Incorrecto:**
```typescript
// No importar entre features directamente
import { Cliente } from '@/features/clientes'  // ❌ En features/productos

// No usar rutas relativas largas
import { useTenant } from '../../../features/auth'  // ❌

// No importar desde lib/ (legacy)
import { something } from '@/lib/...'  // ❌ Migrar a features o shared
```

---

## 🚀 Agregar una Nueva Feature

1. **Crear estructura:**
```
src/features/nueva-feature/
├── index.ts
├── nueva-feature.service.ts
├── nueva-feature.types.ts
└── components/
    └── NuevoComponente.tsx
```

2. **Exportar en `index.ts`:**
```typescript
export * from './nueva-feature.service'
export { default as NuevoComponente } from './components/NuevoComponente'
```

3. **Usar en páginas:**
```typescript
import { getAlgo, NuevoComponente } from '@/features/nueva-feature'
```

---

## 🔍 Convenciones de Nomenclatura

- **Features:** `kebab-case` (ej: `productos`, `puntos-fidelidad`)
- **Componentes:** `PascalCase` (ej: `ProductGrid.tsx`)
- **Servicios:** `[feature].service.ts` (ej: `productos.service.ts`)
- **Stores:** `[feature]Store.ts` (ej: `cartStore.ts`)
- **Tipos:** `[feature].types.ts` (ej: `ingredients.types.ts`)

---

## 📚 Beneficios de esta Arquitectura

1. **Mantenibilidad:** Cada feature es independiente y fácil de encontrar
2. **Escalabilidad:** Agregar nuevas features no afecta las existentes
3. **Colaboración:** Equipos pueden trabajar en features diferentes sin conflictos
4. **Testing:** Cada feature puede testearse de forma aislada
5. **Reutilización:** `shared/` centraliza código común
6. **Type Safety:** Path aliases y barrel exports mejoran el autocompletado

---

## 🔄 Migración en Progreso

Algunos archivos aún están en `src/lib/` y se están migrando gradualmente:
- ✅ Features principales migradas
- ✅ Componentes compartidos migrados
- ⏳ Algunos servicios legacy pendientes

---

**Última actualización:** Noviembre 2025
**Versión de arquitectura:** Feature-based v1.0

