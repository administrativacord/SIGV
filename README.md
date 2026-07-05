# SIGV Web - Fase 2.7 Facturación y cita embajada

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Ajustes aplicados en esta versión

- Se agregó la sección **6. Facturación** en **Nuevo caso** y en el detalle editable de **Casos**.
- La sección de facturación incluye los campos:
  - Nombre.
  - Cédula o NIT.
  - Teléfono.
  - Dirección.
  - Correo.
  - Tipo de trámite: Primera vez, Renovación, Actualización o Global Entry.
  - Medio de pago: Transferencia o Efectivo.
  - Valor calculado automáticamente según el tipo de trámite y las tarifas configuradas.
- Se agregó el botón **Copiar datos del cliente** para facilitar el diligenciamiento de la información de facturación.
- Se agregó la sección **7. Fecha Cita embajada** con selector de fecha sin hora.
- **Observaciones y seguimiento** ya no tiene numeración y quedó ubicado justo encima de **Estado del Proceso**.
- Se mantuvo la uniformidad del orden entre **Nuevo caso** y **Casos**.
- El resumen automático ahora muestra información resumida de facturación y la fecha de cita de embajada cuando aplique.

## Se mantiene desde fases anteriores

- Sección **Configuración** con tarifas de asesoría editables.
- Listado editable de **Asesoras** conectado con:
  - **Nuevo caso** > Asesor responsable.
  - **Casos** > Detalle editable del caso > Asesor responsable.
- Valores informativos para el cliente separados de la facturación de AmCham:
  - Envío documentación Bogotá / Renovación.
  - Derechos consulares.
  - FedEx domicilio.
  - FedEx Alto Prado.
- Los valores informativos no se suman a los ingresos ni a la facturación de AmCham.
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

Para validar compilación:

```bash
npm run build
```

Usuario de prueba: `admin`  
Clave: `1234`

## Notas

- Esta fase todavía no conecta Google Sheets.
- Los datos y la configuración se guardan localmente en el navegador para pruebas internas.
- El ZIP oficial no incluye `node_modules/`, `dist/` ni `package-lock.json`.


## Fase 2.7 - Ajustes operativos

- Configuración ahora se guarda únicamente con el botón Guardar.
- Se agregó modal para notificaciones y confirmaciones en Configuración.
- En Facturación se agregó el botón Copiar datos Facturación para copiar los datos en texto organizado.


## Fase 2.7

- Se retiraron los botones rápidos de cambio de estado en el detalle de casos.
- El estado del caso solo se modifica desde la sección final Estado del Proceso.
