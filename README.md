# SIGV Web — Fase 5C.6 · Facturación mensual

Base oficial: `2.9.5_SIGV_Web_Fase_5C5_Control_Descuento.zip`.

- Versión interna: `5.2.6`
- Build: `2026-07-31-05C6`

## Objetivo

Separar en el Dashboard dos momentos diferentes del proceso:

1. **Valor estimado generado:** valor actual de las asesorías creadas durante el mes seleccionado.
2. **Valor facturado:** valor de las asesorías que fueron marcadas como facturadas durante el mes seleccionado, aunque hayan sido creadas en un mes anterior.

Estos indicadores son independientes y no deben sumarse entre sí.

## Resumen financiero mensual

El Dashboard incorpora un selector mensual compartido con el calendario y muestra:

- Valor estimado generado en el mes.
- Valor facturado en el mes.
- Desglose de lo facturado:
  - generado y facturado en el mismo mes;
  - proveniente de meses anteriores.
- Pendiente actual por facturar de lo generado durante el mes.
- Cantidad de visas correspondiente a cada lectura.

Ejemplo: una asesoría creada el 28 de julio y marcada como facturada el 3 de agosto aparece en el valor estimado de julio y en el valor facturado de agosto como proveniente de meses anteriores.

## Fecha y valor de facturación

Cuando una asesoría cambia de `Por facturar` a `Facturada`, SIGV guarda automáticamente:

```txt
facturacion.fechaFacturacionIso
facturacion.fechaFacturacionMs
facturacion.valorFacturado
facturacion.cantidadVisasFacturadas
```

El valor y la cantidad de visas quedan como una fotografía del momento de facturación. Las ediciones posteriores del expediente no trasladan ni modifican retroactivamente ese registro mensual.

SIGV también conserva `valorEstimado` y `cantidadVisasEstimadas`. Esta fotografía evita que un cambio futuro en las tarifas generales modifique retroactivamente los meses anteriores. Mientras la asesoría siga por facturar, el estimado se actualiza al guardar cambios; después de facturar queda congelado junto con la fotografía de facturación.

Si la asesoría vuelve a `Por facturar`, la fecha y la fotografía se eliminan. Cuando vuelva a marcarse como `Facturada`, se registrará la nueva fecha.

## Compatibilidad

- No requiere migración manual de Firestore.
- Las asesorías antiguas marcadas como facturadas intentan recuperar la fecha desde su historial.
- Los registros antiguos sin fecha técnica ni movimiento identificable se muestran en una alerta y no se atribuyen artificialmente a un mes.
- Se conservaron el Total de visas, calendario, Ciudad, Wompi, precio manual, control de descuento, diseño de dos columnas y seguridad de roles.

## Publicación

```bash
npm install --package-lock=false
npm run check
npm run build
```

Esta versión no modifica `firestore.rules`, por lo que no exige publicar reglas nuevas respecto de la versión 2.9.5.
