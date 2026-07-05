# SIGV Web - Fase 3.2 Firebase Firestore REST seguro

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Cambio principal de esta fase

Esta versión deja de depender del almacenamiento local como fuente principal y conecta SIGV con **Firebase Authentication** y **Cloud Firestore**.

## Funcionalidades incluidas

- Login real con Firebase Authentication usando correo y contraseña.
- Carga de casos desde Firestore usando REST API autenticada para evitar bloqueos del canal en tiempo real.
- Creación de nuevos casos en la colección `casos`.
- Edición y seguimiento de casos directamente en Firestore.
- Configuración guardada en Firestore en `configuracion/general`.
- Respaldo local automático solo como apoyo si la conexión falla temporalmente.
- Indicador visual de conexión Firebase, usuario autenticado y botón de diagnóstico “Probar Firestore”.
- Reglas básicas de Firestore incluidas en `firestore.rules`.
- Mantiene los ajustes de Fase 2:
  - Email opcional.
  - Cantidad de integrantes.
  - Descuentos automáticos desde 3 y 5 integrantes.
  - Estados del Proceso al final del formulario.
  - Configuración de tarifas, valores informativos y asesoras.
  - Resumen automático compacto al final.

## Estructura Firestore usada

```text
casos/{idCaso}
configuracion/general
usuarios/{uid}    // reservado para control de usuarios/roles en una próxima fase
```

Cada documento en `casos` conserva los datos generales del caso y el arreglo de integrantes. En una fase posterior se puede separar integrantes e historial en subcolecciones si el volumen crece.

## Configuración usada

La conexión está en:

```text
src/firebase.js
```

Proyecto Firebase:

```text
projectId: sigv-44772
```

## Pasos obligatorios en Firebase Console

1. Entrar al proyecto **SIGV**.
2. Ir a **Authentication**.
3. Entrar a **Sign-in method**.
4. Activar **Email/Password**.
5. Crear al menos un usuario en **Authentication > Users**.
6. Ir a **Firestore Database**.
7. Crear base de datos.
8. Iniciar en modo producción o prueba, pero luego pegar las reglas incluidas en `firestore.rules`.

## Reglas básicas incluidas

El archivo `firestore.rules` permite leer, crear y actualizar casos solo a usuarios autenticados. No permite eliminar casos.

```text
allow read, create, update: if request.auth != null;
allow delete: if false;
```

## Ejecutar

```bash
npm install
npm run dev
```

Para validar compilación:

```bash
npm run build
```

## Importante

Este ZIP no incluye:

```text
node_modules/
dist/
package-lock.json
```

Después de descomprimirlo, debes ejecutar `npm install` para instalar Firebase y las demás dependencias.


## Corrección Fase 3.1

Esta versión corrige bloqueos donde la pantalla podía quedarse en "Guardando..." o "Cargando información desde Firestore...".

Cambios aplicados:

- Firestore inicializa con detección automática de long polling para redes corporativas o navegadores que bloquean el canal normal de streaming.
- La carga inicial tiene un tiempo máximo de 12 segundos y muestra un mensaje claro si Firestore no responde.
- Guardar caso, actualizar caso y guardar configuración tienen un tiempo máximo de 15 segundos para evitar que la interfaz quede bloqueada.
- Los mensajes de error ahora muestran el detalle técnico que devuelve Firebase.

Si el login funciona pero no aparecen casos, revisar en Firebase Console:

1. Firestore Database debe estar creado.
2. Las reglas del archivo firestore.rules deben estar publicadas.
3. El usuario debe iniciar sesión con Authentication > Email/Password.
4. Al crear un caso debe aparecer un documento en la colección casos.


## Corrección Fase 3.2

Esta versión cambia la carga principal de Firestore a una conexión REST autenticada. Esto ayuda cuando el SDK web de Firestore se queda esperando respuesta por el canal de tiempo real/WebChannel en algunas redes corporativas, antivirus, proxies o navegadores.

Cambios aplicados:

- La app ya no depende de `onSnapshot` para cargar casos.
- La lectura de `casos` y `configuracion/general` se realiza por REST con token del usuario autenticado.
- Guardar caso, actualizar caso y guardar configuración también usan REST autenticado.
- Se agregó botón **Probar Firestore** para crear un documento de diagnóstico en `__diagnostico__/conexion`.
- Se agregó permiso temporal para la colección `__diagnostico__` en `firestore.rules`.
- Firestore SDK conserva `experimentalForceLongPolling`, pero la operación principal queda por REST para mayor estabilidad.

Después de publicar estas reglas, al presionar **Probar Firestore** debe aparecer un documento en:

```text
Firestore Database > Datos > __diagnostico__ > conexion
```

Si el diagnóstico falla con error 403, el problema son las reglas. Si falla con error 404 o indica base no encontrada, falta crear Cloud Firestore Database. Si queda sin responder, la red está bloqueando `firestore.googleapis.com`.
