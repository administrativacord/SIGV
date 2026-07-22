# SIGV Web · Fase 5B · Resumen del Proceso

Esta versión continúa sobre **2.7 / Fase 5A.1 Seguridad reconstruida**. Conserva la seguridad real por roles, la colección técnica `casos`, los consecutivos desde `A0001`, los datos existentes y la compatibilidad con la instalación actual.

## Versión

- Aplicación: `5.1.0`
- Identificación visible: `Fase 5B Web · Resumen del Proceso`
- Build: `2026-07-21-05B`

## Cambios funcionales

### Navegación plegable

El panel de navegación dejó de ocupar una columna permanente. El botón **☰ Menú** abre un panel lateral superpuesto que puede cerrarse con el botón ×, haciendo clic fuera del menú o presionando Escape. Así el área principal aprovecha todo el ancho disponible en computador.

### Diseño de tres columnas

En **Nueva asesoría** y en el **Detalle de asesoría**, la pantalla de computador se organiza en:

1. **Información e integrantes:** asesor responsable, cantidad, datos personales, tipo de solicitud y documentos.
2. **Gestión del proceso:** fecha y hora de asesoría, facturación, cita de embajada, observaciones, estado, seguimiento e historial.
3. **Resumen del Proceso:** resumen visible y actualizado mientras se diligencia o edita la asesoría.

En pantallas medianas se adapta a dos columnas y en celulares se muestra una sola columna para conservar legibilidad.

### Resumen del Proceso

Se reemplazó el nombre **Resumen automático** por **Resumen del Proceso**. La tercera columna muestra, para cada integrante:

- Nombre.
- Tipo de solicitud.
- Valor individual.
- Tarifa base y porcentaje de descuento cuando aplica.

También conserva cantidad de integrantes, subtotal, descuento grupal, total a facturar, valores informativos, estado, documentos, programación, facturación y fecha de cita de embajada.

### Medio de pago Wompi

Se agregó **Wompi** al selector de medio de pago en Facturación. Los registros anteriores con Transferencia, Efectivo o campos vacíos mantienen compatibilidad.

## Seguridad conservada

Las reglas siguen validando el perfil en `usuariosSigv/{correo-en-minúscula}` y el documento `configuracion/seguridad`:

- Administrador activo: gestión total, configuración, usuarios y eliminación de asesorías.
- Asesor activo: lectura, creación y actualización operativa, sin configuración ni eliminación.
- Usuarios sin perfil, inactivos o con rol inválido: acceso bloqueado.
- Inicialización controlada del primer Administrador y protección del Administrador principal.

Lee `MIGRACION_FASE_5.md` antes de publicar las reglas estrictas en una instalación que todavía no haya completado la migración de seguridad.

## Instalación y validación

Requiere Node.js 20.19 o superior.

```bash
npm install --package-lock=false
npm run check
npm run build
```

Para desarrollo:

```bash
npm run dev
```

## Archivos excluidos

El ZIP no incluye:

- `node_modules/`
- `dist/`
- `package-lock.json`
