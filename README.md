# SIGV Web · Fase 5C · Calendario mensual y ciudad

Esta versión continúa sobre **2.8.1 / Fase 5B.1**, conserva el diseño definitivo de dos columnas y mantiene sin cambios la seguridad reconstruida de la Fase 5A.

## Versión

- Aplicación: `5.2.0`
- Identificación visible: `Fase 5C Web · Calendario mensual y ciudad`
- Build: `2026-07-21-05C`

## Cambios funcionales

### Calendario mensual en Dashboard

El Dashboard incorpora un calendario navegable por mes. Cada día muestra únicamente la cantidad de asesorías creadas, por ejemplo `1 creada` o `3 creadas`.

Al seleccionar una fecha aparece un detalle dividido en:

1. **Asesorías creadas:** identificación, cliente o grupo, tipo de solicitud, asesor y estado. Cada tarjeta abre el expediente completo.
2. **Historial y actualizaciones del día:** creación, seguimientos y actualizaciones registradas en el historial de las asesorías, con fecha y hora, usuario responsable y descripción.

Los eventos nuevos guardan `fecha`, `fechaIso` y `fechaMs`. Esto mejora la ubicación cronológica sin romper los historiales anteriores, que continúan interpretándose desde su campo `fecha`.

Las asesorías antiguas se ubican usando `createdAtIso`, `createdAtMs` o, como respaldo, el evento de Creación del historial. Si un registro muy antiguo no tiene ninguna fecha disponible, seguirá funcionando, pero no podrá aparecer retroactivamente en el calendario.

### Resumen del Proceso más compacto

Se conserva exactamente el ancho de la segunda columna. Solo se redujeron de forma moderada:

- Tamaño de la tipografía.
- Espacios internos.
- Separación entre integrantes.
- Altura de líneas, tarjetas, totales y cajas informativas.

La primera columna continúa mostrando todo el proceso y la segunda permanece dedicada al Resumen del Proceso.

### Ciudad en Facturación

Se agregó el campo **Ciudad** dentro de Facturación. El dato se guarda como:

```text
facturacion.ciudad
```

También aparece al copiar los datos de facturación y en el Resumen del Proceso.

Firestore no requiere migración ni creación previa de columnas. Las asesorías nuevas o editadas guardarán el campo automáticamente. Las asesorías antiguas que no tengan `facturacion.ciudad` abrirán normalmente con el campo vacío.

### Funciones conservadas

- Diseño de dos columnas.
- Menú lateral plegable.
- Resumen individual por integrante.
- Descuentos por cantidad.
- Medio de pago Wompi.
- Consecutivos desde A0001.
- Colección técnica `casos`.
- Compatibilidad con registros anteriores.

## Seguridad conservada

No se modificaron `firestore.rules`, `src/firebase.js` ni `src/firestoreRest.js` respecto a la versión 2.8.1.

- Administrador activo: gestión total, configuración, usuarios y eliminación de asesorías.
- Asesor activo: lectura, creación y actualización operativa.
- Usuarios sin perfil, inactivos o con rol inválido: acceso bloqueado.
- Inicialización controlada del primer Administrador.

## Instalación y validación

Requiere Node.js 20.19 o superior.

```bash
npm install --package-lock=false
npm run check
npm run build
```

## Archivos excluidos

El ZIP no incluye `node_modules/`, `dist/` ni `package-lock.json`.
