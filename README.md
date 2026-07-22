# SIGV Web · Fase 5C.1 · Estado de la app

Esta versión continúa sobre **2.9 / Fase 5C** y limpia la interfaz principal concentrando la información técnica en una nueva opción del menú llamada **Estado de la app**.

## Versión

- Aplicación: `5.2.1`
- Identificación: `Fase 5C.1 Web · Estado de la app`
- Build: `2026-07-21-05C1`

## Limpieza de la interfaz

Se retiraron de Dashboard, Nueva asesoría, Asesorías, Plantillas y Configuración los siguientes elementos técnicos:

- Versión y build visibles en el encabezado.
- Firebase conectado.
- Seguridad activa o pendiente.
- Rol de la sesión.
- Nombre y correo del usuario.
- Botón Probar Firestore.
- Resultado del diagnóstico técnico.

El encabezado conserva solamente el botón de menú, el título de la pantalla y un indicador discreto **Guardando...** cuando existe una operación en curso.

## Nueva sección Estado de la app

La nueva opción está disponible para todos los usuarios activos desde el menú lateral. Reúne:

- Versión instalada y compilación.
- Estado de la conexión con Firebase.
- Estado de seguridad.
- Usuario, correo y rol de la sesión actual.
- Prueba manual de conexión con Firestore.
- Resultado del diagnóstico.
- Alertas técnicas que requieran revisión.

Cuando existe una novedad técnica, el menú muestra un pequeño indicador junto a **Estado de la app**, sin llenar de mensajes las pantallas operativas.

## Funciones conservadas

- Calendario mensual con cantidad de asesorías creadas por día.
- Detalle diario de asesorías e historial de actualizaciones.
- Diseño principal de dos columnas.
- Resumen del Proceso compacto.
- Campo Ciudad en Facturación.
- Medio de pago Wompi.
- Menú lateral plegable.
- Roles y seguridad de Firestore.
- Compatibilidad con asesorías anteriores.

## Base de datos

Esta actualización es únicamente visual y de navegación. **No requiere migración ni cambios en Firestore.**

## Instalación

Requiere Node.js 20.19 o superior.

```bash
npm install --package-lock=false
npm run check
npm run build
```

El ZIP no incluye `node_modules/`, `dist/` ni `package-lock.json`.
