# SIGV Web · Fase 5C.4 · Precio manual por integrante

Esta versión continúa sobre **2.9.2 / Fase 5C.2** y agrega un ajuste manual de precio por integrante sin alterar las tarifas generales configuradas.

## Versión

- Aplicación: `5.2.3`
- Identificación: `Fase 5C.4 Web · Precio manual por integrante`
- Build: `2026-07-24-05C4`

## Precio individual editable

Dentro de cada tarjeta de integrante se muestra el valor vigente de la asesoría. Para usuarios con rol **Administrador** aparece un botón discreto **✎ Editar precio**.

El Administrador puede:

- Reemplazar el precio base únicamente para ese integrante.
- Ver inmediatamente el nuevo valor reflejado en el Resumen del Proceso.
- Recalcular automáticamente subtotal, descuento por cantidad y total a facturar.
- Restaurar la tarifa general configurada mediante **Restaurar tarifa**.

El precio personalizado sustituye la tarifa base del integrante. Los descuentos grupales existentes continúan funcionando: 10 % desde 3 integrantes y 15 % desde 5 integrantes.

Al cambiar el tipo de cliente/paquete o el tipo de solicitud de un integrante, cualquier precio personalizado de ese integrante se elimina automáticamente y vuelve a utilizarse la tarifa correspondiente de Configuración.

## Seguridad

El ajuste de precio no depende únicamente de ocultar el botón en la interfaz. `firestore.rules` protege el nuevo mapa `ajustesPrecio`:

- Administrador activo: puede crear o modificar precios personalizados.
- Asesor activo: puede seguir creando y editando asesorías, pero no puede crear ni alterar precios personalizados.
- Si una asesoría ya posee un precio personalizado, el Asesor puede editar los demás datos siempre que conserve ese ajuste sin modificaciones.

Para que esta protección quede activa en producción deben publicarse también las nuevas reglas de Firestore incluidas en el ZIP.

## Firestore

Los precios personalizados se guardan en cada asesoría dentro de:

`ajustesPrecio`

Es un mapa cuyo identificador corresponde al integrante y cuyo valor es el precio base personalizado. **No requiere migración de la base de datos.** Las asesorías antiguas que no tengan este campo continúan utilizando las tarifas generales de Configuración.

## Funciones conservadas

- Datos del cliente y tipo de solicitud unificados.
- Calendario mensual y detalle de actividad diaria.
- Diseño de dos columnas.
- Resumen del Proceso compacto.
- Ciudad en Facturación.
- Wompi.
- Estado de la app.
- Menú lateral plegable.
- Inicialización y seguridad por roles.

## Instalación

Requiere Node.js 20.19 o superior.

```bash
npm install --package-lock=false
npm run check
npm run build
```

El ZIP no incluye `node_modules/`, `dist/` ni `package-lock.json`.

## Fase 5C.4 - Total de visas

- El Dashboard diferencia asesorías de visas.
- `Total de visas` suma la cantidad de integrantes de todas las asesorías.
- Dentro de la misma tarjeta se muestran `Por facturar` y `Facturadas`.
- Facturación incorpora `Estado de facturación`: Por facturar / Facturada.
- Las asesorías anteriores sin este campo se consideran `Por facturar` hasta que se actualicen.
- Una asesoría de 5 integrantes cuenta como 1 asesoría y 5 visas.
