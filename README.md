# SIGV Web — Fase 5C.11 · Filtros por fecha y exportación Excel

Base oficial: `2.9.10_SIGV_Web_Fase_5C10_Reconciliacion_Visas_Julio.zip`.

- Versión interna: `5.2.11`
- Build: `2026-07-31-05C11`

## Cambios en el menú Asesorías

Se incorporó un panel de **Calendario y periodo de consulta** que filtra las asesorías por su fecha de creación.

Modos disponibles:

- **Todas:** conserva el listado completo.
- **Mes completo:** permite seleccionar cualquier mes mediante el control mensual del navegador.
- **Rango de fechas:** permite indicar una fecha inicial, una fecha final o un rango abierto por uno de sus extremos.

El periodo se combina con los filtros existentes de búsqueda, estado del proceso y tipo de solicitud. La tabla siempre muestra el resultado conjunto de todos los criterios seleccionados.

## Exportación a Excel

El botón **Exportar Excel** genera un archivo `.xlsx` válido con exactamente las asesorías visibles en pantalla. No requiere instalar una librería adicional en el navegador ni agregar nuevas dependencias npm.

El libro contiene dos hojas:

1. **Asesorías:** una fila por expediente, con fecha de creación, asesor, integrantes, cantidad de visas, estado, datos de facturación, subtotal, descuento, total estimado y valor facturado.
2. **Visas:** una fila por integrante, con sus datos, tipo de cliente, tipo de solicitud, tarifa, precio personalizado, descuento y valor individual estimado.

Los encabezados quedan congelados, las columnas tienen anchos legibles, los importes conservan formato monetario y ambas hojas incluyen autofiltro de Excel.

## Criterio de fecha

El filtro utiliza `createdAtIso` o `createdAtMs`. Para registros históricos utiliza como respaldo el evento de creación del historial. Las asesorías sin una fecha de creación identificable no se incluyen cuando se selecciona un mes o rango, pero sí permanecen disponibles en el modo **Todas**.

## Compatibilidad

- No modifica Firestore ni requiere migración de datos.
- No modifica `firestore.rules`.
- Conserva la reconciliación de facturación de julio de la Fase 5C.10.
- Conserva seguridad, roles, calendario del Dashboard, facturación mensual, descuentos, precios personalizados y afiliación grupal.
- El ZIP no incluye `node_modules`, `dist` ni `package-lock.json`.

## Publicación

```bash
npm install --package-lock=false
npm run check
npm run build
```

Para esta actualización no es necesario volver a publicar las reglas de Firestore si ya se publicaron las de la versión anterior.
