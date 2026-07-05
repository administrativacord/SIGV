# SIGV Web - Fase 2.5 Facturación y cita embajada

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Ajustes aplicados en esta versión

- En **Nuevo caso** y en **Casos** se reorganizó el flujo operativo.
- **Observaciones y seguimiento** ya no tiene numeración.
- **Observaciones y seguimiento** queda ubicado al final, justo antes de **Estado del Proceso**.
- Se agregó el paso **6. Facturación** en Nuevo caso y en el detalle editable de Casos.
- La sección **Facturación** incluye:
  - Nombre.
  - Cédula o NIT.
  - Teléfono.
  - Dirección.
  - Correo.
  - Tipo de trámite: Primera vez, Renovación, Actualización o Global Entry.
  - Medio de pago: Transferencia o Efectivo.
  - Valor calculado automáticamente según el tipo de trámite y la tarifa configurada.
- Se agregó el paso **7. Fecha Cita embajada**.
- La fecha de cita de embajada se registra mediante un selector de fecha, sin hora.
- Los cambios se aplicaron tanto al formulario de creación como al formulario de edición del caso.

## Se mantiene desde fases anteriores

- Sección **Configuración** con tarifas de asesoría editables.
- Listado editable de **Asesoras** conectado con:
  - **Nuevo caso** > Asesor responsable.
  - **Casos** > Detalle editable del caso > Asesor responsable.
- Los valores de envío de documentación, FedEx y derechos consulares siguen siendo **valores informativos para el cliente**.
- Esos valores informativos no se suman a la facturación de AmCham.
- Base React + Vite limpia y ejecutable.
- Login simple de prueba.
- Dashboard con métricas operativas.
- Nuevo caso con campos obligatorios: asesor, nombre completo, teléfono y email.
- Checklist dinámico según tipo de solicitud.
- Estado del Proceso automático o manual.
- Listado de casos con búsqueda y filtros.
- Apertura y edición completa de cada caso.
- Seguimiento operativo por caso.
- Historial cronológico de movimientos.
- Acciones rápidas.
- Plantillas y respuestas rápidas personalizadas por caso.
- Persistencia local en el navegador mediante `localStorage`.

## Estados del Proceso disponibles

- Pendiente Documentación
- Pendiente de pago Asesoría
- Pendiente de pago Derechos consulares
- Pendiente Agendamiento de Asesoría
- Asesoría Agendada
- Pendiente Facturación
- Pendiente Cita embajada
- Finalizado

## Ejecutar

```bash
npm install
npm run dev
```

Usuario de prueba: `admin`  
Clave: `1234`

## Notas

- Esta fase todavía no conecta Google Sheets.
- Los datos y la configuración se guardan localmente en el navegador para pruebas internas.
- El ZIP oficial no incluye `node_modules/`, `dist/` ni `package-lock.json`.
