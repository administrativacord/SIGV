# SIGV Web - Fase 2.3 Configuración

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Ajustes aplicados en esta versión

- Se cambió la sección **Tarifas** por **Configuración**.
- La nueva sección **Configuración** permite editar los valores de las tarifas de asesoría.
- Se agregó edición de costos adicionales:
  - Envío de documentación a Bogotá para renovaciones.
  - Derechos consulares en USD.
  - FedEx domicilio.
  - FedEx Alto Prado.
- Se agregó un listado editable de **Asesoras**.
- El listado de asesoras queda conectado con:
  - **Nuevo caso** > Asesor responsable.
  - **Casos** > Detalle editable del caso > Asesor responsable.
- Los formularios ahora usan selector de asesora, evitando escribir nombres manualmente y mejorando la uniformidad de los registros.
- Los cambios en configuración se guardan automáticamente en el navegador mediante `localStorage`.
- Al modificar tarifas o costos, los cálculos de casos y resúmenes se actualizan con la configuración vigente.

## Se mantiene desde fases anteriores

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
