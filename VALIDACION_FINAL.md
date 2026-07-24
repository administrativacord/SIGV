# Validación final · Fase 5C.3

Validaciones previstas para esta versión:

- Base oficial: `2.9.2_SIGV_Web_Fase_5C2_Datos_Solicitud_Unificados.zip`.
- Botón discreto **Editar precio** por integrante.
- Ajuste disponible únicamente para Administrador en la interfaz.
- Precio personalizado almacenado en `ajustesPrecio` sin modificar las tarifas generales.
- Recalculo del subtotal, descuento por cantidad y total usando el nuevo precio.
- Resumen del Proceso identifica el precio personalizado.
- Opción **Restaurar tarifa**.
- Cambio de tipo de cliente o solicitud elimina el precio personalizado anterior.
- Reducción de integrantes elimina ajustes huérfanos.
- Reglas Firestore reforzadas para impedir que un Asesor altere `ajustesPrecio`.
- Asesorías antiguas compatibles sin migración.
- Calendario, Ciudad, Wompi, dos columnas y Estado de la app conservados.
- Dependencias con versiones exactas.
- ZIP sin `node_modules`, `dist` ni `package-lock.json`.

Antes de publicar desde una extracción limpia:

```bash
npm install --package-lock=false
npm run check
npm run build
```

## Resultado en el entorno de preparación

- `npm run check`: aprobado.
- Transpilación JSX con TypeScript: aprobada.
- `npm install --package-lock=false`: no finalizó dentro del tiempo disponible del entorno, por lo que `npm run build` no pudo ejecutarse aquí.
- No se generaron `node_modules`, `dist` ni `package-lock.json` dentro del paquete final.
