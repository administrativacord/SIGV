# Validación final — Fase 5C.6

## Funcionalidad validada

- El antiguo recuadro general `Facturación estimada AmCham` fue reemplazado por un resumen financiero mensual.
- El selector mensual controla simultáneamente el resumen financiero y el calendario de asesorías.
- El valor estimado se calcula por fecha de creación.
- El valor facturado se calcula por fecha real de facturación.
- El valor facturado diferencia lo generado en el mismo mes de lo proveniente de meses anteriores.
- El pendiente corresponde únicamente a asesorías creadas en el mes seleccionado que actualmente siguen por facturar.
- Al marcar una asesoría como facturada se guardan fecha, valor y cantidad de visas como fotografía histórica.
- El valor estimado y la cantidad de visas estimadas se conservan para impedir que cambios futuros en la configuración de tarifas alteren retroactivamente los reportes mensuales.
- Una asesoría creada en julio y facturada en agosto permanece en el estimado de julio y se registra en la facturación de agosto.
- Los registros históricos facturados recuperan la fecha desde el historial cuando existe.
- Los registros sin fecha identificable no se asignan artificialmente al mes actual.
- Al cargar asesorías se respetan los precios manuales y el estado del descuento por cantidad para evitar alterar los totales del reporte.
- Se conservaron las funciones y reglas de seguridad de la versión 2.9.5.
- No se incluyen `node_modules`, `dist` ni `package-lock.json`.

## Prueba financiera ejecutada

Escenario:

- $1.000.000 creados y facturados en julio.
- $2.000.000 creados en julio y pendientes.
- $1.500.000 creados en junio y facturados en julio.
- $500.000 creados en julio y facturados en agosto.

Resultado de julio:

- Estimado generado: $3.500.000.
- Facturado: $2.500.000.
- Facturado del mismo mes: $1.000.000.
- Facturado de meses anteriores: $1.500.000.
- Pendiente actual por facturar: $2.000.000.

Resultado de agosto:

- Estimado generado: $0.
- Facturado: $500.000.
- Proveniente de meses anteriores: $500.000.

## Resultados técnicos

- `npm run check`: aprobado.
- Transpilación sintáctica JSX con TypeScript: aprobada.
- Prueba aislada de distribución financiera entre julio y agosto: aprobada.
- `npm install --package-lock=false --ignore-scripts`: no completado. El registro interno respondió `404` para `firebase@11.10.0` y el intento directo contra npm público excedió el tiempo disponible; por ello no se generó `dist` en este entorno.

## Comandos antes de producción

```bash
npm install --package-lock=false
npm run check
npm run build
```
