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

if (errors.length) {
  console.error('Validación SIGV fallida:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Validación SIGV Fase 5A aprobada.');
