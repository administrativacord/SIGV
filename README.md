# SIGV Web — Fase 5C.5 · Control de descuento por cantidad

Base: `2.9.4_SIGV_Web_Fase_5C4_Total_Visas.zip`.

- Versión interna: `5.2.5`
- Build: `2026-07-30-05C5`

## Cambio principal

En el paso **2. Cantidad** se agregó un control discreto para activar o desactivar el descuento automático por cantidad en cada asesoría.

- Activado: conserva las reglas actuales de 10 % desde 3 integrantes y 15 % desde 5 integrantes.
- Desactivado: no aplica descuento aunque la asesoría tenga 3, 5 o más integrantes.
- El cambio recalcula inmediatamente los valores de cada integrante, el total de Facturación y el Resumen del Proceso.
- La selección se guarda en Firestore como `aplicarDescuentoCantidad`.
- Los registros anteriores que no tienen el campo se interpretan como descuento activado, conservando su comportamiento histórico.
- Solo el Administrador puede modificar el control. Los Asesores pueden ver su estado, pero no cambiarlo.
- Activar o desactivar el descuento queda registrado en el historial de la asesoría.

## Seguridad

Las reglas de Firestore fueron reforzadas para que un Asesor no pueda cambiar `aplicarDescuentoCantidad` desde fuera de la interfaz. Al publicar esta versión también deben desplegarse las nuevas reglas.

## Publicación

```bash
npm install --package-lock=false
npm run check
npm run build
firebase deploy --only firestore:rules
```

Después se puede publicar el contenido de `dist` en el servicio de hosting utilizado por SIGV.
