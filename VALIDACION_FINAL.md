# Validación final · Fase 5C.2

Validaciones realizadas:

- Base oficial: `2.9.1_SIGV_Web_Fase_5C1_Estado_de_la_App.zip`.
- Pasos 3 y 4 unidos como **3. Datos del cliente y tipo de solicitud**.
- Una sola tarjeta por integrante para datos personales y selección del trámite.
- Pasos siguientes renumerados del 4 al 7.
- Nueva opción de navegación **Estado de la app** conservada.
- Información técnica retirada del encabezado y las pantallas operativas.
- Versión, build, conexión, seguridad, usuario y rol concentrados en la nueva sección.
- Prueba Firestore y su resultado ubicados únicamente en Estado de la app.
- Indicador discreto en el menú cuando existe una novedad técnica.
- Indicador Guardando visible solo durante operaciones en curso.
- Dashboard, calendario, detalle diario, Ciudad, Wompi y Resumen del Proceso conservados.
- Diseño de dos columnas conservado.
- `firestore.rules`, `src/firebase.js` y `src/firestoreRest.js` sin cambios funcionales.
- Dependencias con versiones exactas.
- ZIP sin `node_modules`, `dist` ni `package-lock.json`.

Esta fase no requiere migración ni actualización de Firestore.

Antes de publicar desde una extracción limpia:

```bash
npm install --package-lock=false
npm run check
npm run build
```

La instalación completa de npm fue intentada en el entorno de preparación, pero el registro no respondió dentro del tiempo disponible. La validación estructural y la transpilación JSX sí fueron aprobadas.
