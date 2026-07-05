# SIGV Web · Fase 4A.4 · Asesorías

Base tomada de la Fase 3.4 estable con Firebase Authentication, Firestore por REST, diagnóstico de conexión, creación y carga de asesorías desde la nube.

## Cambios principales de la Fase 4A

### 1. Roles operativos
Se agregaron dos roles iniciales para el sistema:

- **Administrador**: puede ver todo, crear asesorías, editar asesorías, consultar asesorías, eliminar asesorías con confirmación, editar configuración general, modificar tarifas, valores informativos y agregar asesoras.
- **Asesor**: puede crear asesorías, editar asesorías y cambiar estados del proceso. No puede entrar a Configuración ni modificar tarifas o valores generales.

El rol se muestra en la barra superior después de iniciar sesión.

### 2. Colección `usuariosSigv`
La aplicación ahora busca el perfil del usuario autenticado en Firestore usando la colección:

```txt
usuariosSigv
```

El ID del documento debe ser el correo del usuario en minúscula. Ejemplo:

```txt
usuariosSigv/milena@empresa.com
```

Estructura sugerida del documento:

```json
{
  "nombre": "Milena",
  "email": "milena@empresa.com",
  "rol": "asesor",
  "activo": true
}
```

Roles válidos:

```txt
administrador
asesor
```

### 3. Administrador provisional
Para evitar que el sistema quede bloqueado al iniciar la Fase 4A, si un usuario autenticado no tiene todavía documento en `usuariosSigv`, la app lo habilita como **Administrador provisional**. Desde Configuración se recomienda guardar ese mismo correo como Administrador para dejarlo registrado formalmente.

### 4. Gestión de usuarios y roles
En **Configuración** se agregó el bloque **Usuarios y roles**. Desde allí el Administrador puede registrar usuarios ya creados en Firebase Authentication y asignarles rol operativo dentro de SIGV.

Importante: esta pantalla no crea cuentas de Firebase Authentication. Primero se debe crear el usuario con email y contraseña en Firebase Authentication y luego registrarlo en SIGV desde esta sección.

### 5. Restricción visual por rol
El rol Asesor ya no ve la opción **Configuración** en el menú lateral. Tampoco puede acceder a esa vista por navegación interna. La edición de tarifas, costos informativos y asesoras queda reservada al Administrador.

### 6. Eliminación controlada de asesorías
Se agregó la opción **Eliminar asesoría** únicamente para Administrador dentro del detalle de la asesoría. La eliminación solicita dos confirmaciones:

1. Confirmación general del navegador.
2. Escritura exacta de la palabra `ELIMINAR`.

Esto reduce el riesgo de borrar asesorías por error.

### 7. Reglas de Firestore
El archivo `firestore.rules` fue actualizado para incluir la colección `usuariosSigv` y permitir eliminación de asesorías a usuarios autenticados. En esta Fase 4A el control fino de permisos se aplica principalmente desde la interfaz. En una fase posterior puede reforzarse con reglas estrictas basadas en roles.

## Instalación

```bash
npm install
npm run dev
```

## Construcción

```bash
npm run build
```

## Archivos excluidos del ZIP

Este paquete no debe incluir:

- `node_modules/`
- `dist/`
- `package-lock.json`


## Fase 4A.2 - ajustes aplicados

- El resumen automático en el detalle de Asesorías queda al final del formulario, compacto, como en Nueva asesoría.
- Las nuevas asesorías usan el consecutivo SIGV: A0001 hasta A9999; luego B0001 hasta B9999, y así sucesivamente con C, D, etc.
- Se mantiene compatibilidad con IDs anteriores tipo CAS-2026-0001 para calcular el siguiente consecutivo.
- Se agregó protección anti-bloqueo: si no existe ningún Administrador activo en `usuariosSigv`, el usuario autenticado entra como Administrador provisional para corregir roles.
- Se agregó botón **Reiniciar roles**: deja el usuario actual como Administrador activo y los demás usuarios como Asesor activo.
- La interfaz impide guardar cambios que dejen el sistema sin al menos un Administrador activo.


## Corrección Fase 4A.2

- Se ajustó el consecutivo de asesorías para que el primera asesoría sea `A0001` y todos los IDs mantengan 4 dígitos después de la letra: `A0001` a `A9999`, luego `B0001` a `B9999`, y así sucesivamente.


## Corrección Fase 4A.3

- En la pantalla **Asesorías / Detalle**, las secciones **Nuevo seguimiento** e **Historial cronológico** fueron movidas al final del formulario.
- Ambas secciones quedaron recogidas/cerradas por defecto para no cargar visualmente la pantalla.
- Al presionar **Ver**, se despliega el contenido; al presionar **Ocultar**, vuelve a cerrarse.
- Se mantiene sin cambios la lógica de roles, permisos y consecutivo de asesorías `A0001` a `A9999`, `B0001` a `B9999`, etc.

## Corrección Fase 4A.4

- Se ajustó el lenguaje visible de la interfaz para que el módulo pase de **Casos** a **Asesorías**.
- El botón y la pantalla **Nuevo caso** ahora se muestran como **Nueva asesoría**.
- Se mantuvo internamente la colección Firestore `casos` para no romper compatibilidad con datos existentes, IDs y respaldos.
