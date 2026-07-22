# Validación final · Fase 5B.1

Validaciones completadas en el paquete:

- Base de seguridad de Fase 5A conservada sin cambios en `firestore.rules`, `src/firebase.js` y `src/firestoreRest.js` respecto a la versión 2.8.
- Estructura obligatoria presente.
- `npm run check` aprobado con comprobaciones específicas de Fase 5B.1.
- `main.jsx` transpilado correctamente con TypeScript en modo React JSX, sin errores sintácticos.
- Nueva asesoría y Detalle de asesoría contienen exactamente dos bloques principales dentro de `process-layout`: proceso completo y Resumen del Proceso.
- Se eliminó la cuadrícula principal de tres columnas de la versión 2.8.
- El proceso completo permanece en la primera columna y el resumen en la segunda.
- Diseño responsivo: una sola columna por debajo de 980 px.
- Menú lateral plegable conservado, sin ocupar una columna permanente.
- Resumen individual por integrante conservado con nombre, tipo de solicitud y valor.
- Opción `Wompi` conservada en el medio de pago.
- Dependencias con versiones exactas; no se utiliza `latest`, `^`, `~` ni `*`.
- No se incluyen `node_modules`, `dist` ni `package-lock.json`.

La instalación de dependencias fue intentada en el entorno de preparación, pero no concluyó dentro del tiempo disponible debido a la respuesta del registro npm. Antes de publicar en producción debe ejecutarse desde una extracción limpia:

```bash
npm install --package-lock=false
npm run check
npm run build
```
