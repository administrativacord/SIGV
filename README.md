# SIGV Web - Fase 2.9 Email opcional y descuentos por cantidad

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Ajustes aplicados en esta versión

- En **Nuevo caso**, el email de los clientes/integrantes dejó de ser obligatorio.
- En **Casos**, al editar un caso también se permite guardar integrantes sin email, manteniendo obligatorio solo nombre y teléfono.
- En **Nuevo caso**, se quitó la columna lateral de **Resumen automático** para dejar el formulario más limpio y amplio.
- El **Resumen automático** ahora queda al final del formulario en formato compacto.
- Se agregó descuento automático por cantidad de integrantes sobre la facturación de AmCham:
  - Desde **3 integrantes**: 10% de descuento.
  - Desde **5 integrantes**: 15% de descuento.
- El descuento se aplica únicamente sobre las tarifas de asesoría de AmCham, no sobre valores informativos como FedEx, derechos consulares o envío de documentación.
- Se agregó el nuevo paso **2. Cantidad** debajo de **1. Asesor responsable**.
- El campo de cantidad permite indicar cuántos integrantes tiene el caso, por ejemplo un grupo familiar.
- Según la cantidad seleccionada, el sistema despliega para cada integrante:
  - **3. Datos del cliente**.
  - **4. Tipo de solicitud**.
  - **5. Documentos recibidos**.
- Se ajustó la numeración del flujo operativo:
  1. Asesor responsable.
  2. Cantidad.
  3. Datos del cliente.
  4. Tipo de solicitud.
  5. Documentos recibidos.
  6. Asesoría.
  7. Facturación.
  8. Fecha Cita embajada.
- **Observaciones y seguimiento** se mantiene sin numeración, justo antes de **Estado del Proceso**.
- **Estado del Proceso** se mantiene al final y sigue siendo la única forma segura de cambiar el estado manualmente.
- El cálculo de **Facturación AmCham** suma las tarifas de todos los integrantes del caso y aplica el descuento por cantidad cuando corresponda.
- El conteo de documentos y el estado automático se calculan tomando en cuenta todos los integrantes.
- En **Casos**, la búsqueda permite encontrar cualquier integrante del caso, no solo el principal.
- Las plantillas ahora identifican documentos pendientes por integrante.

## Se mantiene desde fases anteriores

- Sección **Configuración** con tarifas de asesoría editables mediante botón **Guardar**.
- Modal para confirmaciones y notificaciones en Configuración.
- Listado editable de **Asesoras** conectado con:
  - **Nuevo caso** > Asesor responsable.
  - **Casos** > Detalle editable del caso > Asesor responsable.
- Valores informativos para el cliente separados de la facturación de AmCham:
  - Envío documentación Bogotá / Renovación.
  - Derechos consulares.
  - FedEx domicilio.
  - FedEx Alto Prado.
- Los valores informativos no se suman a los ingresos ni a la facturación de AmCham.
- Botón **Copiar datos Facturación** en la sección de facturación.
- Base React + Vite limpia y ejecutable.
- Login simple de prueba.
- Dashboard con métricas operativas.
- Listado de casos con búsqueda y filtros.
- Apertura y edición completa de cada caso.
- Seguimiento operativo por caso.
- Historial cronológico de movimientos.
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
