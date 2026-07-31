# Migración segura desde Fase 4A.4 Web

Esta versión conserva las colecciones y documentos existentes. No requiere borrar ni trasladar asesorías.

## Orden recomendado

### 1. Respaldo

Antes de publicar, exporta o respalda Firestore, especialmente:

- `casos`
- `configuracion`
- `usuariosSigv`

### 2. Publicar primero la aplicación

Publica el nuevo frontend en Vercel manteniendo temporalmente las reglas que están funcionando actualmente.

### 3. Ingresar con el Administrador real

Inicia sesión con la cuenta que debe conservar el control administrativo.

Se presentará uno de estos escenarios:

- **El perfil ya existe como Administrador activo:** SIGV cerrará automáticamente la inicialización y mostrará `Seguridad activa`.
- **El correo no tiene perfil y la seguridad aún no fue configurada:** aparecerá `Configurar primer Administrador`. Confirma únicamente con la cuenta administrativa correcta.
- **El perfil es Asesor:** no debe usarse para realizar la migración. Cierra sesión e ingresa con el Administrador.

### 4. Verificar Configuración

Entra a `Configuración > Seguridad de acceso` y confirma:

- Estado `Protección activa`.
- Correo correcto en `Administrador principal protegido`.
- Al menos un Administrador activo en la tabla de usuarios.

También confirma en Firestore que exista:

```txt
configuracion/seguridad
```

con:

```txt
primerAdministradorConfigurado = true
inicializacionCerrada = true
primerAdministradorEmail = correo administrativo correcto
```

### 5. Publicar las reglas estrictas

Desde la raíz del proyecto:

```bash
firebase deploy --only firestore:rules
```

También puedes copiar el contenido de `firestore.rules` en Firebase Console y publicarlo.

### 6. Pruebas posteriores

Con un Administrador:

- Abrir y editar una asesoría.
- Crear una asesoría de prueba.
- Guardar configuración.
- Editar un usuario.
- Ejecutar `Probar Firestore`.

Con un Asesor:

- Abrir, crear y editar asesorías.
- Confirmar que Configuración no aparezca.
- Confirmar que no pueda eliminar asesorías.

Con un usuario de Firebase Authentication sin documento en `usuariosSigv`:

- Confirmar que quede bloqueado.
- Confirmar que no sea promovido automáticamente.

### 7. Limpieza de la prueba

Elimina únicamente la asesoría de prueba utilizando una cuenta Administrador, si fue creada.

## Recuperación

Si se publicaron las reglas antes de configurar correctamente al Administrador:

1. Vuelve temporalmente a las reglas anteriores.
2. Publica la aplicación Fase 5A.1.
3. Ingresa con la cuenta administrativa.
4. Activa la seguridad y verifica `configuracion/seguridad`.
5. Publica nuevamente las reglas estrictas.

No elimines `configuracion/seguridad` después de la activación.

## Nota adicional para Fase 5C.3 · Precio manual por integrante

Esta versión agrega protección específica para `ajustesPrecio`. Después de publicar el frontend 5C.3, vuelve a publicar `firestore.rules` para que el ajuste manual de precios quede restringido realmente al rol Administrador.

No requiere migrar documentos existentes: las asesorías antiguas sin `ajustesPrecio` continúan usando las tarifas generales.

## Actualización Fase 5C.5

No requiere migración manual de datos. El campo `aplicarDescuentoCantidad` se crea al guardar una asesoría nueva o editar una existente. La ausencia del campo se interpreta como `true` para conservar el descuento histórico. Deben publicarse las reglas de Firestore incluidas en esta versión.

## Actualización Fase 5C.6

No requiere migración manual. Cuando una asesoría se marca como facturada, la aplicación empieza a guardar automáticamente la fecha real, el valor facturado y la cantidad de visas facturadas dentro de `facturacion`. También se guardan `valorEstimado` y `cantidadVisasEstimadas` en el documento de la asesoría para estabilizar el histórico mensual.

Las asesorías antiguas ya facturadas intentan recuperar su fecha desde el evento correspondiente del historial. Si no existe fecha ni evento identificable, SIGV no asigna el registro al mes actual: el Dashboard muestra una advertencia para evitar distorsionar el reporte.

Esta versión no cambia `firestore.rules` respecto de Fase 5C.5.
