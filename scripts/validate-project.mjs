import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'package.json',
  'index.html',
  'firebase.json',
  'firestore.rules',
  'src/main.jsx',
  'src/firebase.js',
  'src/firestoreRest.js',
  'src/styles.css',
  'src/xlsxExport.js',
  'MIGRACION_FASE_5.md',
  'VALIDACION_FINAL.md',
];

const errors = [];
for (const file of required) {
  if (!existsSync(resolve(root, file))) errors.push(`Falta ${file}`);
}
for (const forbidden of ['node_modules', 'dist', 'package-lock.json']) {
  if (existsSync(resolve(root, forbidden))) errors.push(`No debe incluirse ${forbidden}`);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (pkg.version !== '6.0.2') errors.push(`La versión esperada es 6.0.2 y se encontró ${pkg.version}`);
for (const [group, deps] of Object.entries({ dependencies: pkg.dependencies || {}, devDependencies: pkg.devDependencies || {} })) {
  for (const [name, version] of Object.entries(deps)) {
    if (version === 'latest' || version.includes('*') || version.startsWith('^') || version.startsWith('~')) {
      errors.push(`${group}.${name} debe tener una versión exacta y tiene ${version}`);
    }
  }
}

const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
for (const expected of ['activeAdmin()', 'bootstrapSecurity()', 'primerAdministradorConfigurado', 'allow delete: if activeAdmin()', 'preservesCreationDate()', 'preservesPriceOverrides()', 'noPriceOverridesOnCreate()', 'noDiscountOverrideOnCreate()', 'preservesDiscountSetting()', 'validFacturacionStructure(data)', 'validFacturacionAudit(data)', 'validFacturacionUpdate()', 'preservesFacturacionAudit()']) {
  if (!rules.includes(expected)) errors.push(`Las reglas no contienen: ${expected}`);
}

const main = readFileSync(resolve(root, 'src/main.jsx'), 'utf8');
for (const forbidden of ['perfilAdministradorProvisional', 'Administrador provisional']) {
  if (main.includes(forbidden)) errors.push(`Persistió lógica insegura: ${forbidden}`);
}

for (const expected of [
  "Fase 6A.2 Web · Fecha de creación editable con auditoría",
  'puedeCambiarFechaCreacion: esAdministrador',
  'function fechaCreacionDesdeClave',
  'async function cambiarFechaCreacionCaso',
  'Cambio de fecha de creación',
  'className="creation-date-control"',
  'className="process-layout"',
  'className="panel summary process-summary"',
  '>Resumen del Proceso<',
  '<option value="Wompi">Wompi</option>',
  'sidebar-drawer',
  'menu-button',
  'function CalendarioAsesorias',
  'Calendario de asesorías del periodo',
  'calendar-created-count',
  'Historial y actualizaciones del día',
  'Field label="Ciudad"',
  'facturacion.ciudad ||',
  'fechaIso: ahora.toISOString()',
  'function EstadoApp',
  "vista === 'estadoApp'",
  '>Estado de la app<',
  'className="app-status-grid"',
  'Compilación {BUILD_ID}',
  'Comprobación de Firestore',
  '>3. Datos del cliente y tipo de solicitud<',
  'className="integrante-subsection"',
  '>4. Documentos recibidos<',
  '>5. Asesoría<',
  '>6. Facturación<',
  '>7. Fecha Cita embajada<',
  'function normalizarAjustesPrecio',
  'ajustesPrecio: normalizarAjustesPrecio(form.ajustesPrecio)',
  'ajustesPrecio: normalizarAjustesPrecio(casoActualizado.ajustesPrecio)',
  'puedeEditarPrecio={permisos.esAdministrador}',
  '>✎ Editar precio<',
  '>Restaurar tarifa<',
  'Precio personalizado aplicado.',
  'function VisasCard',
  '>Total de visas<',
  '>Por facturar<',
  '>Facturadas<',
  'estadoFactura',
  '<label>Estado de facturación',
  'function descuentoCantidadActivo',
  'function describirCambioDescuento',
  'function ControlDescuentoCantidad',
  'aplicarDescuentoCantidad: true',
  'Descuento por cantidad: ${descuentoCantidadActivo(form)',
  'descuentoCantidadHabilitado={calculo.aplicarDescuentoCantidad}',
  'descuentoCantidadHabilitado={calc.aplicarDescuentoCantidad}',
  'Desactivado para esta asesoría',
  "activo ? 'Activado' : 'Desactivado'",
  'function facturacionConFecha',
  'fechaFacturacionIso',
  'fechaFacturacionMs',
  'valorFacturado',
  'cantidadVisasFacturadas',
  'valorEstimado',
  'cantidadVisasEstimadas',
  'function valorEstimadoCaso',
  'function resumenFinancieroMes',
  'function ResumenFacturacionMensual',
  '>Facturación del periodo AmCham<',
  '>Valor estimado generado<',
  '>Valor facturado<',
  '>Pendiente actual por facturar<',
  '>Generado y facturado en el periodo<',
  '>Proveniente de fechas anteriores<',
  'Los indicadores son independientes y no deben sumarse entre sí.',
  'className="invoice-date-note"',
  'function tipoClienteEsAfiliado',
  'function hayIntegranteAfiliado',
  'function facturacionSegunAfiliacion',
  'nombreEmpresaAfiliada',
  'requiereEmpresaAfiliada={hayIntegranteAfiliado(integrantes)}',
  'Field label="Nombre de la empresa afiliada"',
  'Line label="Empresa afiliada"',
  'Nombre de la empresa afiliada: ${datos.nombreEmpresaAfiliada}',
  'const tipoClienteReferencia = actuales[0]?.tipoCliente',
  'El tipo de cliente o paquete se aplica a toda la asesoría.',
  'const idsConCambio = lista',
  'idsConCambio.forEach(integranteId => delete nuevosAjustes[integranteId])',
  'tipoClienteKey: tipoCliente',
  'FECHA_MIGRACION_FACTURACION_JULIO_ISO',
  'function migrarFacturacionInicialJulio',
  'function requiereReconciliacionFacturacionJulio',
  'function facturacionAutomaticaReal',
  'migracionJulio2026Completada',
  'periodoFacturacion',
  'facturadoPor',
  'fechaFacturacionInferida',
  'Corrección inicial de facturación',
  'function construirHojasExportacion',
  'function nombreArchivoExportacion',
  'Calendario y periodo de consulta',
  'Mes completo',
  'Rango de fechas',
  '↓ Exportar Excel',
  'type="month"',
  'descargarLibroXlsx',
  "nombre: 'Asesorías'",
  "nombre: 'Visas'",
  'function FiltroPeriodoDashboard',
  '>Periodo del Dashboard<',
  'El periodo seleccionado controla las tarjetas operativas',
  'function resumenFinancieroPeriodo',
  'function fechaDentroPeriodo',
  'function casoPremiumPendiente',
  'title="Pendiente Paquete Premium"',
  'casosPeriodo.filter(casoPremiumPendiente)',
  'subtitulo="Periodo seleccionado"',
  'Asesorías recientes del periodo',
  'outside-period',
]) {
  if (!main.includes(expected)) errors.push(`La Fase 6A.1 no contiene: ${expected}`);
}

const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
for (const expected of [
  'grid-template-columns: minmax(0, 1.72fr) minmax(320px, .78fr)',
  '@media (max-width: 980px)',
  '.process-summary',
  '.sidebar-drawer.open',
  '.calendar-grid',
  '.calendar-created-count',
  '.process-summary { font-size: 13px; padding: 17px; }',
  '.app-status-page',
  '.app-status-grid',
  '.status-card',
  '.nav-alert-dot',
  '.save-indicator',
  '.integrante-price-row',
  '.price-edit-button',
  '.price-editor-actions',
  '.discount-control',
  '.discount-toggle.is-on',
  '.discount-toggle.is-off',
  '.dashboard-operational-cards',
  '.monthly-finance-panel',
  '.monthly-finance-grid',
  '.finance-metric-card',
  '.finance-breakdown',
  '.invoice-date-note',
  '.case-date-filter',
  '.case-date-filter-header',
  '.excel-export-button',
  '.date-filter-modes',
  '.date-filter-fields',
  '.date-filter-summary',
  '.dashboard-period-panel',
  '.dashboard-period-header',
  '.finance-period-label',
  '.calendar-cell.outside-period',
  '.creation-date-control',
]) {
  if (!styles.includes(expected)) errors.push(`Los estilos de Fase 6A.1 no contienen: ${expected}`);
}

const processLayoutCount = (main.match(/className="process-layout"/g) || []).length;
const processColumnCount = (main.match(/className="panel process-column"/g) || []).length;
if (processLayoutCount !== 2) errors.push(`Se esperaban 2 process-layout y se encontraron ${processLayoutCount}`);
if (processColumnCount !== 2) errors.push(`Se esperaba una sola columna de proceso por pantalla (2 en total) y se encontraron ${processColumnCount}`);
if (styles.includes('minmax(390px, 1.18fr) minmax(340px, 1fr) minmax(300px, .84fr)')) errors.push('Persistió la cuadrícula anterior de tres columnas');
if (main.includes('>3. Datos del cliente<') || main.includes('>4. Tipo de solicitud<')) errors.push('Persistieron los pasos separados de datos y solicitud');

const xlsx = readFileSync(resolve(root, 'src/xlsxExport.js'), 'utf8');
for (const expected of ['crearArchivoXlsx', 'descargarLibroXlsx', '[Content_Types].xml', 'xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) {
  if (!xlsx.includes(expected)) errors.push(`El exportador Excel no contiene: ${expected}`);
}

if (errors.length) {
  console.error('Validación SIGV fallida:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Validación SIGV Fase 6A.2 aprobada.');
