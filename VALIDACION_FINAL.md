# Validación final — Fase 6C.1

## Resultado

La versión `6.2.0`, build `2026-08-05-06C01`, fue revisada sobre la base oficial de la Fase 6B.4.

## Comprobaciones aprobadas

- `npm run check`: aprobado.
- Compilación de producción con Vite 7.3.1: aprobada (40 módulos transformados).
- Control de fecha ubicado al inicio del detalle de la asesoría.
- Permiso ligado exclusivamente al rol activo `administrador`.
- Validación de formato, fecha futura y cambio sin variación.
- Confirmación explícita con fecha anterior, nueva e impacto operativo.
- Actualización conjunta de `createdAtIso` y `createdAtMs`.
- Auditoría con fecha anterior, fecha nueva, usuario autenticado y momento del cambio.
- Regla `preservesCreationDate()` para impedir cambios del rol `asesor`.
- Nuevo módulo Agenda Google exclusivo para Administradores activos.
- Rango predeterminado desde hoy hasta 30 días adelante y límite de 366 días.
- Autorización OAuth limitada a `calendar.readonly`.
- Lectura paginada, recurrencias expandidas y orden por fecha de inicio.
- Agrupación diaria y clasificación orientativa de posibles eventos de visa.
- Token temporal mantenido únicamente en memoria.
- Corrección administrativa de valor facturado y tipo de trámite.
- Conservación de la fecha histórica de facturación.
- Auditoría estructurada de cada corrección financiera.
- Desglose de asesorías y visas provenientes de fechas anteriores.
- Acceso directo desde el desglose financiero al detalle de la asesoría.
- Control compacto y discreto para la fecha de creación.
- Corrección administrativa de la fecha real de facturación.
- Actualización coherente de fecha ISO, milisegundos y periodo de facturación.
- Validación que impide fechas futuras y auditoría de fecha anterior y nueva.
- Agenda Google extraída de `main.jsx` a un módulo independiente.
- Separación de interfaz, servicio OAuth/REST, utilidades y estilos.
- Ausencia de la implementación heredada de Calendar dentro del archivo principal.
- Creación condicional que falla si el consecutivo ya existe.
- Recarga de consecutivos del servidor y reintento controlado ante colisiones.
- Reglas que preservan creador y primer evento histórico en toda actualización.
- Protección aplicable también a sesiones con rol Administrador.
- Metadatos `updateTime` conservados desde las lecturas de Firestore.
- Escrituras de asesorías condicionadas a la versión exacta leída.
- Conflictos simultáneos bloqueados sin sobrescritura silenciosa.
- Mensaje operativo para recargar cuando otra persona guardó primero.
- Presencia del filtro superior **Periodo del Dashboard**.
- Modos **Mes completo** y **Rango de fechas**.
- Aplicación del periodo a todas las tarjetas operativas.
- Aplicación del periodo al Total de visas y su desglose.
- Aplicación del periodo al resumen financiero, calendario y asesorías recientes.
- Nueva tarjeta **Pendiente Paquete Premium**.
- Lógica Premium validada para `premiumAfiliado`, `premiumNoAfiliado` y sus etiquetas visibles históricas.
- Exclusión de asesorías cuyo Estado del Proceso sea `Finalizado`.
- Navegación del calendario limitada al rango seleccionado.
- Días externos al rango deshabilitados.
- Reglas de Firestore reforzadas sin ampliar permisos a otros roles.
- Exportación Excel y filtros del menú Asesorías preservados.
- Ausencia de `node_modules`, `dist` y `package-lock.json` en el paquete final.

## Compilación en este entorno

La compilación de producción fue ejecutada correctamente con Vite 7.3.1. Los directorios temporales `node_modules` y `dist` se eliminaron antes de crear el ZIP final. Para repetir la validación en el entorno habitual:

```bash
npm install --package-lock=false
npm run check
npm run build
```

## Publicación y migraciones

No requiere migración de datos. Sí requiere publicar el archivo `firestore.rules` incluido para activar la protección del lado del servidor.
