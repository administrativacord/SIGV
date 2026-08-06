# SIGV Web — Fase 6C.1 · Protección contra sobrescritura

Base oficial: `2.9.11_SIGV_Web_Fase_5C11_Filtros_Fecha_Exportacion_Excel.zip`.

- Versión interna: `6.2.0`
- Build: `2026-08-05-06C01`

## Incidente A0039 y causa corregida

El consecutivo se calculaba en cada navegador y la creación utilizaba `PATCH`. Dos sesiones con la misma lista podían elegir simultáneamente A0039; la segunda petición actualizaba el documento existente y reemplazaba la asesoría original.

La creación ahora incluye la precondición Firestore `currentDocument.exists=false`. Si otro usuario reservó primero el ID, Firestore rechaza la escritura, SIGV recarga los consecutivos desde el servidor y reintenta hasta cinco veces con el siguiente ID. En ningún caso convierte una creación en actualización.

Las reglas incorporan además `preservesCaseIdentity()`: toda actualización debe conservar el creador original y el primer movimiento del historial. Esta segunda barrera también aplica a Administradores y bloquea intentos de sustituir el contenido completo de una asesoría existente.

## Trabajo simultáneo seguro

Las asesorías cargadas incluyen la versión `updateTime` entregada por Firestore. Cada edición, cambio de fecha, corrección financiera o migración se guarda con esa precondición. Si otra persona modificó antes el mismo registro, Firestore rechaza el segundo guardado en lugar de sobrescribir silenciosamente; SIGV informa que debe recargarse y revisar la versión actual.

Este control permite que varias personas creen asesorías simultáneamente y que trabajen sobre casos distintos sin interferencia. Si dos personas editan exactamente la misma asesoría, gana el primer guardado y el segundo queda bloqueado para revisión manual.

## Arquitectura modular de Agenda Google

La integración con Google Calendar fue extraída de `main.jsx` y organizada bajo `src/modules/google-calendar/`. La interfaz, el servicio OAuth/REST, las utilidades de fechas y clasificación, y los estilos ahora tienen responsabilidades independientes. Esta refactorización no cambia el comportamiento visible ni los permisos de solo lectura.

## Corrección de facturación registrada

Los Administradores activos pueden desplegar **Corregir facturación registrada** dentro del detalle de una asesoría facturada. El control permite corregir el valor efectivamente facturado, el tipo de trámite y la fecha real de facturación, y exige confirmación explícita.

Cada corrección agrega al historial el valor anterior, el nuevo, el tipo anterior, el nuevo, la fecha anterior, la nueva, el correo del Administrador y el momento exacto. Los Asesores no reciben este permiso. La fecha actualiza también `periodoFacturacion`, por lo que el registro pasa al mes o rango correcto del Dashboard.

## Facturación proveniente de fechas anteriores

La tarjeta **Facturación del periodo AmCham** ahora permite desplegar las asesorías que componen el indicador proveniente de fechas anteriores. Muestra ID, cliente, fecha de creación, fecha de facturación, cantidad de visas, valor facturado y acceso directo al detalle.

## Fecha de creación compacta

El control de fecha de creación se redujo a una sola línea discreta con fecha y botón **Cambiar fecha**. La explicación funcional permanece disponible como ayuda contextual.

## Agenda Google Calendar

Se agregó un módulo exclusivo para Administradores activos que consulta eventos programados en Google Calendar sin modificarlos. El rango inicial comprende desde el día actual hasta 30 días adelante y puede ajustarse hasta un máximo de 366 días.

Los eventos se solicitan con el alcance OAuth `https://www.googleapis.com/auth/calendar.readonly`, se expanden las recurrencias y se ordenan por hora de inicio. El módulo los agrupa por día y clasifica como posibles visas los títulos, descripciones, ubicaciones o asistentes que contengan términos operativos relacionados con visas.

El token de acceso permanece únicamente en memoria durante la sesión del navegador. SIGV no almacena tokens ni incorpora operaciones para crear, editar o eliminar eventos.

## Configuración inicial de Google

1. En Google Cloud habilita **Google Calendar API**.
2. Configura la pantalla de consentimiento OAuth.
3. Crea un **ID de cliente OAuth 2.0** de tipo Aplicación web.
4. Agrega la dirección publicada en Vercel a **Orígenes JavaScript autorizados**.
5. En SIGV entra a **Configuración → Integración con Google Calendar** y guarda el ID de cliente.
6. Conserva `primary` como ID de calendario para leer el calendario principal de la cuenta que autorice el acceso, o registra el ID de un calendario compartido.
7. Abre **Agenda Google**, selecciona el rango y pulsa **Conectar y escanear**.

## Cambio de fecha de creación

Al inicio del detalle de cada asesoría se muestra su fecha de creación. Únicamente un usuario activo con el rol interno `administrador` puede editarla y confirmar el cambio. La aplicación valida el formato, impide fechas futuras y evita guardar la misma fecha.

Antes de actualizar se presenta una confirmación con la fecha anterior, la nueva y el impacto operativo. Al confirmar se actualizan conjuntamente `createdAtIso` y `createdAtMs`, por lo que el cambio se refleja de inmediato en filtros, Dashboard, calendario, métricas y exportación Excel.

Cada modificación agrega un movimiento al historial con la fecha anterior, la fecha nueva, el correo del Administrador y el momento exacto del cambio. Las reglas de Firestore impiden que el rol `asesor` modifique cualquiera de los campos de creación, incluso mediante una solicitud directa fuera de la interfaz.

## Filtro global del Dashboard

Se agregó el panel **Periodo del Dashboard** en la parte superior, antes de las tarjetas operativas.

Modos disponibles:

- **Mes completo:** permite seleccionar cualquier mes.
- **Rango de fechas:** permite consultar desde una fecha inicial hasta una fecha final. También admite rangos abiertos por uno de sus extremos.
- **Periodo actual:** restablece el mes actual o el rango correspondiente al mes actual.

El filtro controla conjuntamente:

- Asesorías registradas.
- Total de visas.
- Visas por facturar y facturadas.
- Pendientes.
- Pendientes de agendamiento.
- Asesorías agendadas.
- Pendiente Paquete Premium.
- Resumen financiero.
- Calendario e historial diario.
- Asesorías recientes.

Las tarjetas operativas se filtran por la **fecha de creación de la asesoría**. Los registros sin fecha identificable no se incluyen cuando existe un periodo activo.

## Pendiente Paquete Premium

Se incorporó una tarjeta nueva al lado de **Asesorías agendadas**.

Cuenta una asesoría cuando cumple simultáneamente estas condiciones:

1. El campo **Tipo de cliente / paquete** corresponde a `Paquete Premium Afiliado` o `Paquete Premium No Afiliado`.
2. El **Estado del Proceso** todavía no es `Finalizado`.
3. La asesoría fue creada dentro del mes o rango seleccionado.

El indicador cuenta asesorías, no la cantidad de integrantes o visas.

## Facturación por periodo

El resumen financiero ahora admite mes completo o rango de fechas, conservando la lógica conciliada de la Fase 5:

- **Valor estimado generado:** usa la fecha de creación.
- **Valor facturado:** usa la fecha real de facturación.
- **Generado y facturado en el periodo:** la creación y la facturación ocurrieron dentro del periodo seleccionado.
- **Proveniente de fechas anteriores:** fue creado antes del periodo y facturado durante el periodo.
- **Pendiente actual por facturar:** fue creado dentro del periodo y actualmente continúa por facturar.

Esta separación evita mezclar el valor generado con el valor efectivamente facturado.

## Calendario

El calendario muestra un mes a la vez. En modo rango permite navegar únicamente por los meses comprendidos en el rango seleccionado. Los días que quedan fuera del periodo aparecen deshabilitados. Las asesorías creadas y los movimientos del historial mostrados en el detalle diario también respetan el filtro global.

## Compatibilidad

- No modifica la estructura de Firestore.
- No requiere migración de datos.
- Refuerza `firestore.rules`; las reglas actualizadas deben publicarse junto con la aplicación.
- Conserva filtros y exportación Excel del menú Asesorías.
- Conserva seguridad por roles, precios personalizados, descuentos, afiliación grupal y reconciliación de facturación de julio de 2026.
- El ZIP no incluye `node_modules`, `dist` ni `package-lock.json`.

## Publicación

```bash
npm install --package-lock=false
npm run check
npm run build
```

Es obligatorio publicar las reglas de Firestore incluidas en esta versión para aplicar la protección del cambio de fecha en el servidor.
