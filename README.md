# SIGV Web - Fase 2.4 Costos informativos

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Ajustes aplicados en esta versión

- Se corrigió el manejo de los valores de envío de documentación, FedEx y derechos consulares.
- Estos valores ahora quedan como **valores informativos para el cliente**.
- Los valores informativos **no se suman** al valor de asesoría ni a la facturación de AmCham.
- El resumen automático separa claramente:
  - **Valor asesoría AmCham**.
  - **Total a facturar por AmCham**.
  - **Valores informativos para el cliente**.
- En el Dashboard, la métrica pasó a llamarse **Facturación estimada AmCham**.
- En la tabla de Casos, la columna pasó a llamarse **Facturación AmCham**.
- En Configuración, la sección de costos adicionales ahora se llama **Valores informativos para el cliente**.
- Se mantiene la edición de esos valores para que el equipo pueda actualizarlos cuando cambien, sin afectar los ingresos ni la facturación de la empresa.

## Se mantiene desde fases anteriores

- Sección **Configuración** con tarifas de asesoría editables.
- Listado editable de **Asesoras** conectado con:
  - **Nuevo caso** > Asesor responsable.
  - **Casos** > Detalle editable del caso > Asesor responsable.
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
