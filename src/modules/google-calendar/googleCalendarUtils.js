export const ZONA_HORARIA_CALENDAR = 'America/Bogota';

export function claveFechaCalendar(valor = new Date()) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_CALENDAR, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const datos = Object.fromEntries(partes.map(item => [item.type, item.value]));
  return `${datos.year}-${datos.month}-${datos.day}`;
}

export function sumarDiasClave(clave, dias) {
  const [year, month, day] = clave.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + dias, 12)).toISOString().slice(0, 10);
}

export function fechaEventoGoogle(evento = {}) {
  return evento.start?.date || claveFechaCalendar(evento.start?.dateTime);
}

export function horaEventoGoogle(evento = {}) {
  if (evento.start?.date && !evento.start?.dateTime) return 'Todo el día';
  const fecha = new Date(evento.start?.dateTime || '');
  if (Number.isNaN(fecha.getTime())) return 'Hora no disponible';
  return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: ZONA_HORARIA_CALENDAR }).format(fecha);
}

export function fechaLargaCalendar(clave = '') {
  const [year, month, day] = clave.split('-').map(Number);
  if (!year || !month || !day) return 'Sin fecha identificable';
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA_HORARIA_CALENDAR,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function esEventoVisaGoogle(evento = {}) {
  const asistentes = (evento.attendees || []).map(item => `${item.displayName || ''} ${item.email || ''}`).join(' ');
  const texto = `${evento.summary || ''} ${evento.description || ''} ${evento.location || ''} ${asistentes}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ['visa', 'renovacion', 'primera vez', 'ds 160', 'ds160', 'consular', 'embajada', 'global entry'].some(palabra => texto.includes(palabra));
}
