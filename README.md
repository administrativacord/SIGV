# SIGV Web · Fase 5A.1 · Seguridad reconstruida

Esta versión fue reconstruida tomando como base directa el ZIP que estaba funcionando en producción: **Fase 4A.4 Web.zip**. Conserva las pantallas, cálculos, consecutivos, asesorías existentes y la colección técnica `casos`, pero reemplaza la seguridad dependiente del frontend por autorización real en Firestore.

## Versión

- Aplicación: `5.0.1-a`
- Identificación visible: `Fase 5A.1 Web · Seguridad reconstruida`
- Build: `2026-07-21-05A1`

## Cambios principales

### Seguridad real por roles

Las reglas de Firestore validan el documento del usuario autenticado en:

```txt
usuariosSigv/{correo-en-minúscula}
```

Roles válidos:

```txt
administrador
asesor
```

Todos los usuarios deben tener `activo: true` para utilizar la aplicación.

### Permisos

**Administrador activo**

- Lee, crea y actualiza asesorías.
- Elimina asesorías con la confirmación existente.
- Modifica configuración y tarifas.
- Consulta y administra usuarios y roles.
- Ejecuta diagnósticos de Firestore.

**Asesor activo**

- Lee, crea y actualiza asesorías.
- Cambia estados y agrega seguimientos.
- No elimina asesorías.
- No modifica configuración, tarifas ni usuarios.

**Usuario sin perfil, inactivo o con rol inválido**

- No recibe permisos temporales.
- No puede cargar asesorías ni configuración.
- Ve una pantalla de acceso bloqueado con una explicación clara.

### Primer Administrador controlado

La aplicación utiliza el documento:

```txt
configuracion/seguridad
```

Campos principales:

```json
{
  "primerAdministradorConfigurado": true,
  "primerAdministradorEmail": "correo@empresa.com",
  "inicializacionCerrada": true,
  "versionSeguridad": "5A.1"
}
```

Si ya existe un perfil Administrador activo, SIGV crea automáticamente este documento al iniciar sesión. Si la instalación no tiene perfil ni configuración de seguridad, aparece una pantalla para registrar de forma atómica al primer Administrador y cerrar la inicialización.

Después del cierre, un usuario creado solamente en Firebase Authentication no podrá ingresar hasta que un Administrador lo registre en `usuariosSigv`.

### Protección del Administrador principal

El correo registrado en `primerAdministradorEmail` no puede quedar inactivo ni cambiarse a Asesor. El documento de seguridad tampoco puede eliminarse ni cambiar de propietario desde la aplicación.

### Carga segura

Se eliminó el comportamiento que convertía un error de conexión o la ausencia de perfil en acceso de Administrador. Si Firestore no puede validar el perfil, la aplicación bloquea los permisos y permite reintentar.

### Dependencias fijas

Se eliminó `latest`. Las versiones quedan fijadas en `package.json` y se agregó `npm run check` para revisar estructura, archivos prohibidos y controles mínimos de seguridad.

### Paginación REST

La lectura de colecciones por Firestore REST ahora recorre todas las páginas disponibles, evitando limitar silenciosamente la lista a la primera página.

## Instalación local

Requiere Node.js 20.19 o superior.

```bash
npm install --package-lock=false
npm run check
npm run dev
```

## Construcción

```bash
npm run build
```

## Publicación

Lee primero `MIGRACION_FASE_5.md`. El orden de publicación es importante para comprobar el Administrador antes de activar las reglas estrictas.

Para publicar solamente las reglas:

```bash
firebase deploy --only firestore:rules
```

## Archivos excluidos

El ZIP no incluye:

- `node_modules/`
- `dist/`
- `package-lock.json`
