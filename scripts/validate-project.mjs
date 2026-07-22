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
if (pkg.version !== '5.2.2') errors.push(`La versión esperada es 5.2.2 y se encontró ${pkg.version}`);
for (const [group, deps] of Object.entries({ dependencies: pkg.dependencies || {}, devDependencies: pkg.devDependencies || {} })) {
  for (const [name, version] of Object.entries(deps)) {
    if (version === 'latest' || version.includes('*') || version.startsWith('^') || version.startsWith('~')) {
      errors.push(`${group}.${name} debe tener una versión exacta y tiene ${version}`);
    }
  }
}

const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
for (const expected of ['activeAdmin()', 'bootstrapSecurity()', 'primerAdministradorConfigurado', 'allow delete: if activeAdmin()']) {
  if (!rules.includes(expected)) errors.push(`Las reglas no contienen: ${expected}`);
}

const main = readFileSync(resolve(root, 'src/main.jsx'), 'utf8');
for (const forbidden of ['perfilAdministradorProvisional', 'Administrador provisional']) {
  if (main.includes(forbidden)) errors.push(`Persistió lógica insegura: ${forbidden}`);
}

for (const expected of [
  "Fase 5C.2 Web · Datos y solicitud unificados",
  'className="process-layout"',
  'className="panel summary process-summary"',
  '>Resumen del Proceso<',
  '<option value="Wompi">Wompi</option>',
  'sidebar-drawer',
  'menu-button',
  'function CalendarioAsesorias',
  'Calendario mensual de asesorías',
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
]) {
  if (!main.includes(expected)) errors.push(`La Fase 5C no contiene: ${expected}`);
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
]) {
  if (!styles.includes(expected)) errors.push(`Los estilos de Fase 5C no contienen: ${expected}`);
}

const processLayoutCount = (main.match(/className="process-layout"/g) || []).length;
const processColumnCount = (main.match(/className="panel process-column"/g) || []).length;
if (processLayoutCount !== 2) errors.push(`Se esperaban 2 process-layout y se encontraron ${processLayoutCount}`);
if (processColumnCount !== 2) errors.push(`Se esperaba una sola columna de proceso por pantalla (2 en total) y se encontraron ${processColumnCount}`);
if (styles.includes('minmax(390px, 1.18fr) minmax(340px, 1fr) minmax(300px, .84fr)')) errors.push('Persistió la cuadrícula anterior de tres columnas');
if (main.includes('>3. Datos del cliente<') || main.includes('>4. Tipo de solicitud<')) errors.push('Persistieron los pasos separados de datos y solicitud');

if (errors.length) {
  console.error('Validación SIGV fallida:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Validación SIGV Fase 5C.2 aprobada.');
