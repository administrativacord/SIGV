# SIGV Web - Fase 2.2 Estado del Proceso

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Ajustes aplicados en esta versión

- Se cambió el nombre **Estado operativo** por **Estado del Proceso**.
- **Estado del Proceso** ahora aparece como una sección/título al final del formulario, sin numeración.
- Se aplicó el mismo criterio tanto en **Nuevo caso** como en el detalle editable de **Casos**.
- Se actualizó el filtro de la sección **Casos** para buscar por los nuevos estados del proceso.
- Se actualizaron las métricas del dashboard para trabajar con los nuevos nombres de estado.
- Se mantiene la lógica automática inicial:
  - Si faltan documentos: **Pendiente Documentación**.
  - Si solo falta el soporte de pago de la asesoría: **Pendiente de pago Asesoría**.
  - Si los documentos requeridos están completos: **Pendiente Agendamiento de Asesoría**.
- La asesora puede cambiar manualmente el estado cuando el caso avance a etapas posteriores.

## Estados del Proceso disponibles

- Pendiente Documentación
- Pendiente de pago Asesoría
- Pendiente de pago Derechos consulares
- Pendiente Agendamiento de Asesoría
- Asesoría Agendada
- Pendiente Facturación
- Pendiente Cita embajada
- Finalizado

## Incluye desde la Fase 2

- Base React + Vite limpia y ejecutable.
- Login simple de prueba.
- Dashboard con métricas operativas.
- Nuevo caso con campos obligatorios: asesor, nombre completo, teléfono y email.
- Cálculo automático de tarifas, FedEx, envío de documentación y derechos consulares.
- Checklist dinámico según tipo de solicitud.
- Estado del proceso automático o manual según avance del caso.
- Listado de casos con búsqueda y filtros por estado del proceso y tipo de solicitud.
- Apertura y edición completa de cada caso.
- Seguimiento operativo por caso.
- Historial cronológico de movimientos.
- Acciones rápidas: asesoría agendada, pendiente cita embajada y finalizado.
- Plantillas y respuestas rápidas personalizadas por caso.
- Persistencia local en el navegador mediante localStorage.
- Tabla de tarifas y gastos adicionales.

## Ejecutar

```bash
npm install
npm run dev
```

Usuario de prueba: `admin`  
Clave: `1234`

## Notas

- Esta fase todavía no conecta Google Sheets.
- Los datos se guardan localmente en el navegador para pruebas internas.
- El ZIP oficial no incluye `node_modules/`, `dist/` ni `package-lock.json`.
