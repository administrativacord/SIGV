# Validación final — Fase 5C.5

## Validaciones incluidas

- El proyecto conserva la estructura de dos columnas.
- El Resumen del Proceso, Total de visas, calendario, Ciudad, Wompi y precio manual por integrante permanecen disponibles.
- `aplicarDescuentoCantidad` se inicializa en `true` para nuevas asesorías.
- Los documentos antiguos sin el campo se interpretan como descuento activado.
- El cálculo aplica 10 % desde 3 integrantes y 15 % desde 5 únicamente cuando el control está activo.
- El total de Facturación y el Resumen del Proceso usan el valor recalculado.
- El historial registra la activación o desactivación.
- Firestore impide que un Asesor modifique el control de descuento.
- No se incluyen `node_modules`, `dist` ni `package-lock.json`.

## Comandos recomendados antes de producción

```bash
npm install --package-lock=false
npm run check
npm run build
firebase deploy --only firestore:rules
```

## Resultados ejecutados en el entorno de preparación

- `npm run check`: aprobado.
- Transpilación sintáctica JSX con TypeScript: aprobada.
- Prueba de cálculo con 3 integrantes y descuento activo: subtotal $450.000, descuento $45.000, total $405.000.
- Prueba con 3 integrantes y descuento desactivado: total $450.000.
- Compatibilidad de registro antiguo con 5 integrantes y campo ausente: descuento del 15 % aplicado correctamente.
- `npm install` no pudo completarse porque el registro interno disponible respondió `404` para `firebase@11.10.0`; por ello no se generó `dist` en este entorno.
