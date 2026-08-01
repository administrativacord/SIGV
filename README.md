# SIGV Web — Fase 6A.1 · Dashboard por periodo y Paquetes Premium pendientes

Base oficial: `2.9.11_SIGV_Web_Fase_5C11_Filtros_Fecha_Exportacion_Excel.zip`.

- Versión interna: `6.0.1`
- Build: `2026-08-01-06A01`

## Filtro global del Dashboard

Se agregó el panel **Periodo del Dashboard** en la parte superior, antes de las tarjetas operativas.

Modos disponibles:

- **Mes completo:** permite seleccionar cualquier mes.
- **Rango de fechas:** permite consultar desde una fecha inicial hasta una fecha final. También admite rangos abiertos por uno de sus extremos.
- **Periodo actual:** restablece el mes actual o el rango correspondiente al mes actual.

El filtro controla conjuntamente:

- Asesorías registradas.
- Total de visas.
- Visas por facturar y facturadas.
- Pendientes.
- Pendientes de agendamiento.
- Asesorías agendadas.
- Pendiente Paquete Premium.
- Resumen financiero.
- Calendario e historial diario.
- Asesorías recientes.

Las tarjetas operativas se filtran por la **fecha de creación de la asesoría**. Los registros sin fecha identificable no se incluyen cuando existe un periodo activo.

## Pendiente Paquete Premium

Se incorporó una tarjeta nueva al lado de **Asesorías agendadas**.

Cuenta una asesoría cuando cumple simultáneamente estas condiciones:

1. El campo **Tipo de cliente / paquete** corresponde a `Paquete Premium Afiliado` o `Paquete Premium No Afiliado`.
2. El **Estado del Proceso** todavía no es `Finalizado`.
3. La asesoría fue creada dentro del mes o rango seleccionado.

El indicador cuenta asesorías, no la cantidad de integrantes o visas.

## Facturación por periodo

El resumen financiero ahora admite mes completo o rango de fechas, conservando la lógica conciliada de la Fase 5:

- **Valor estimado generado:** usa la fecha de creación.
- **Valor facturado:** usa la fecha real de facturación.
- **Generado y facturado en el periodo:** la creación y la facturación ocurrieron dentro del periodo seleccionado.
- **Proveniente de fechas anteriores:** fue creado antes del periodo y facturado durante el periodo.
- **Pendiente actual por facturar:** fue creado dentro del periodo y actualmente continúa por facturar.

Esta separación evita mezclar el valor generado con el valor efectivamente facturado.

## Calendario

El calendario muestra un mes a la vez. En modo rango permite navegar únicamente por los meses comprendidos en el rango seleccionado. Los días que quedan fuera del periodo aparecen deshabilitados. Las asesorías creadas y los movimientos del historial mostrados en el detalle diario también respetan el filtro global.

## Compatibilidad

- No modifica la estructura de Firestore.
- No requiere migración de datos.
- No modifica `firestore.rules`.
- Conserva filtros y exportación Excel del menú Asesorías.
- Conserva seguridad por roles, precios personalizados, descuentos, afiliación grupal y reconciliación de facturación de julio de 2026.
- El ZIP no incluye `node_modules`, `dist` ni `package-lock.json`.

## Publicación

```bash
npm install --package-lock=false
npm run check
npm run build
```

No es necesario volver a publicar las reglas de Firestore si ya están desplegadas las de la versión anterior.
