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


## Actualización Fase 5C.7

Se agregó `facturacion.nombreEmpresaAfiliada`, visible únicamente cuando al menos un integrante es Afiliado o Paquete Premium Afiliado. Firestore admite el nuevo campo sin migración manual. No se modificaron las reglas de seguridad.

## Actualización Fase 5C.8

No requiere migración manual. El tipo de cliente o paquete se sincroniza en el frontend para todos los integrantes cuando el usuario cambia la selección en cualquiera de ellos. Los integrantes nuevos heredan la modalidad del primer integrante. Las asesorías históricas con modalidades mixtas no se alteran automáticamente hasta que sean editadas. No se modificaron las reglas de Firestore.


## Actualización Fase 5C.9 — Corrección inicial de julio

Esta versión sí ejecuta una migración automática y controlada sobre las asesorías que ya aparecen como Facturadas.

1. Publica primero el frontend 5C.9.
2. Inicia sesión con un Administrador.
3. Espera a que termine la carga inicial.
4. Entra a `Estado de la app` y revisa `Corrección inicial de facturación`.
5. Confirma que el Dashboard de julio muestre el mismo número de visas facturadas del acumulado general, salvo que exista alguna facturación legítima de otro mes.
6. Publica después las nuevas reglas de Firestore.

Los registros sin fecha identificable reciben `1 de julio de 2026`. Los que ya tenían una fecha válida la conservan. La operación guarda valor, cantidad de visas, periodo y origen de la fecha, y agrega una anotación en el historial.

Desde esta versión las reglas exigen auditoría completa al marcar una asesoría como Facturada. Por esa razón es importante realizar el primer ingreso con Administrador antes de probar ediciones con cuentas Asesor.
