# SIGV Web · Fase 5C.2 · Datos y solicitud unificados

Esta versión continúa sobre **2.9.1 / Fase 5C.1** y simplifica el formulario uniendo los datos del cliente y el tipo de solicitud dentro de una sola tarjeta por integrante.

## Versión

- Aplicación: `5.2.2`
- Identificación: `Fase 5C.2 Web · Datos y solicitud unificados`
- Build: `2026-07-21-05C2`

## Formulario simplificado

Los pasos anteriores **3. Datos del cliente** y **4. Tipo de solicitud** se unificaron como:

- **3. Datos del cliente y tipo de solicitud**

Cada integrante utiliza una sola tarjeta con nombre, teléfono, correo, tipo de cliente o paquete, tipo de solicitud y FedEx cuando aplica. Los pasos posteriores fueron renumerados: Documentos recibidos 4, Asesoría 5, Facturación 6 y Fecha Cita embajada 7.

No se modificó la estructura de los datos ni la forma de guardar en Firestore.

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
