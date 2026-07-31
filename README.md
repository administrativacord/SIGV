# SIGV Web — Fase 5C.9 · Migración de facturación julio

Base oficial: `2.9.8_SIGV_Web_Fase_5C8_Afiliacion_Grupal.zip`.

- Versión interna: `5.2.9`
- Build: `2026-07-31-05C9`

## Objetivo

Corregir la diferencia entre el acumulado general de visas facturadas y el reporte mensual. Los registros antiguos que estaban marcados como Facturados, pero no tenían fecha ni periodo contable, no podían incluirse en julio de 2026.

## Migración automática inicial

Al primer ingreso de un usuario con rol **Administrador**, SIGV revisa las asesorías facturadas:

- Si existe una fecha histórica válida, la conserva y completa los campos técnicos faltantes.
- Si no existe una fecha identificable, asigna `1 de julio de 2026`.
- Congela el valor facturado y la cantidad de visas del registro.
- Añade un evento de Migración al historial.
- No vuelve a modificar una asesoría cuya auditoría ya esté completa.

La corrección puede consultarse en **Estado de la app**, donde se informa cuántas asesorías fueron ajustadas y cuántas visas sin fecha fueron asignadas al 1 de julio.

## Auditoría obligatoria desde esta versión

Cuando una asesoría cambia a **Facturada**, se guardan automáticamente:

- `facturacion.fechaFacturacionIso`
- `facturacion.fechaFacturacionMs`
- `facturacion.periodoFacturacion`
- `facturacion.facturadoPor`
- `facturacion.valorFacturado`
- `facturacion.cantidadVisasFacturadas`
- `facturacion.fechaFacturacionInferida`
- `facturacion.origenFechaFacturacion`

El periodo se calcula con la zona horaria de Colombia. Una asesoría creada en julio y facturada en agosto seguirá apareciendo como valor estimado de julio y como valor facturado de agosto.

## Seguridad

`firestore.rules` fue reforzado para que un usuario activo no pueda marcar una asesoría como Facturada sin registrar fecha, periodo, usuario, valor y cantidad de visas. Una vez facturada, el Asesor no puede alterar silenciosamente esos datos históricos. El Administrador conserva la capacidad de efectuar correcciones controladas.

## Dashboard

La tarjeta **Total de visas** ahora indica que corresponde al **Acumulado general**, mientras que Facturación mensual depende del mes seleccionado.

## Publicación

```bash
npm install --package-lock=false
npm run check
npm run build
```

Publica primero el frontend, ingresa con un Administrador y confirma la migración en **Estado de la app**. Después publica las reglas incluidas:

```bash
firebase deploy --only firestore:rules
```

El ZIP no incluye `node_modules`, `dist` ni `package-lock.json`.
