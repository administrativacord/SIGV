# Validación final · Fase 5C

Validaciones realizadas sobre el paquete:

- Base oficial: `2.8.1_SIGV_Web_Fase_5B1_Dos_Columnas.zip`.
- `firestore.rules`, `src/firebase.js` y `src/firestoreRest.js` conservan exactamente los mismos hashes de la versión 2.8.1.
- Estructura obligatoria presente.
- `npm run check` con comprobaciones específicas de Fase 5C.
- Transpilación de `src/main.jsx` mediante TypeScript en modo React JSX.
- Pruebas de fechas aprobadas para ISO, milisegundos, formato colombiano e historial antiguo.
- Sintaxis de `src/firebase.js` y `src/firestoreRest.js` validada con Node.js.
- El Dashboard contiene calendario mensual navegable.
- Las celdas muestran únicamente la cantidad de asesorías creadas.
- El detalle por día separa asesorías creadas e historial/actualizaciones.
- Los eventos nuevos incorporan fecha legible, ISO y milisegundos.
- Los eventos históricos continúan siendo compatibles mediante lectura del campo `fecha`.
- Campo `facturacion.ciudad` incorporado y normalizado de forma retrocompatible.
- Ciudad incluida en el formulario, texto copiable y Resumen del Proceso.
- Resumen del Proceso compactado sin modificar el ancho de la columna.
- Diseño principal de dos columnas conservado.
- Menú plegable, Wompi, reglas de seguridad y roles conservados.
- Dependencias con versiones exactas.
- ZIP sin `node_modules`, `dist` ni `package-lock.json`.

La instalación de dependencias fue intentada en el entorno de preparación, pero el registro npm no respondió dentro del tiempo disponible. Antes de publicar en producción debe ejecutarse desde una extracción limpia:

```bash
npm install --package-lock=false
npm run check
npm run build
```

Firestore no requiere migración para el campo Ciudad. El nuevo dato se añade automáticamente cuando una asesoría se crea o se vuelve a guardar.
