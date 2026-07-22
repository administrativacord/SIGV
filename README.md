# SIGV Web · Fase 5B.1 · Diseño de dos columnas

Esta versión corrige la distribución visual de **2.8 / Fase 5B** y continúa sobre la seguridad reconstruida de la Fase 5A. Conserva la colección técnica `casos`, los consecutivos desde `A0001`, los datos existentes, el Resumen del Proceso detallado y la opción de pago Wompi.

## Versión

- Aplicación: `5.1.1`
- Identificación visible: `Fase 5B.1 Web · Diseño de dos columnas`
- Build: `2026-07-21-05B1`

## Cambios funcionales

### Diseño definitivo de dos columnas

En **Nueva asesoría** y en el **Detalle de asesoría**, la pantalla de computador se organiza únicamente en:

1. **Proceso completo:** asesor responsable, cantidad, datos de integrantes, tipos de solicitud, documentos, programación de asesoría, facturación, cita de embajada, observaciones, estado, seguimiento e historial.
2. **Resumen del Proceso:** resumen visible y actualizado mientras se diligencia o edita la asesoría.

Se eliminó por completo la división anterior del proceso en dos columnas. El Resumen del Proceso permanece fijo al desplazarse en pantallas amplias. En pantallas menores de 980 px, ambas columnas se muestran una debajo de la otra para conservar legibilidad.

### Navegación plegable

El botón **☰ Menú** mantiene el panel lateral superpuesto. La navegación no ocupa una tercera columna y puede cerrarse con el botón ×, haciendo clic fuera del menú o presionando Escape.

### Resumen del Proceso

El resumen conserva el detalle por integrante:

- Nombre.
- Tipo de solicitud.
- Valor individual.
- Tarifa base y porcentaje de descuento cuando aplica.

También muestra cantidad de integrantes, subtotal, descuento grupal, total a facturar, valores informativos, estado, documentos, programación, facturación y fecha de cita de embajada.

### Medio de pago Wompi

Se conserva **Wompi** en el selector de medio de pago. Los registros anteriores mantienen compatibilidad.

## Seguridad conservada

Las reglas de Firestore y la autorización por roles permanecen sin cambios respecto a la versión 2.8:

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

## Archivos excluidos

El ZIP no incluye `node_modules/`, `dist/` ni `package-lock.json`.
