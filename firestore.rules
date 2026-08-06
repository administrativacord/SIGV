const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
let promesaGoogleIdentity = null;

function cargarGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (promesaGoogleIdentity) return promesaGoogleIdentity;
  promesaGoogleIdentity = new Promise((resolve, reject) => {
    const existente = document.querySelector('script[data-google-identity="sigv"]');
    const script = existente || document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'sigv';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('No fue posible cargar la autorización segura de Google.'));
    if (!existente) document.head.appendChild(script);
  });
  return promesaGoogleIdentity;
}

export async function solicitarTokenLecturaCalendar(clientId) {
  if (!clientId) throw new Error('Primero registra el ID de cliente OAuth de Google en Configuración.');
  const google = await cargarGoogleIdentity();
  return new Promise((resolve, reject) => {
    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: respuesta => respuesta?.access_token
        ? resolve(respuesta.access_token)
        : reject(new Error(respuesta?.error_description || 'Google no entregó autorización de lectura.')),
      error_callback: error => reject(new Error(error?.message || 'La ventana de autorización de Google fue cerrada.')),
    });
    cliente.requestAccessToken({ prompt: 'consent' });
  });
}

export async function listarEventosCalendar({ token, calendarId = 'primary', fechaDesde, fechaHastaExclusiva, timeZone }) {
  const encontrados = [];
  let pageToken = '';
  do {
    const parametros = new URLSearchParams({
      timeMin: `${fechaDesde}T00:00:00-05:00`,
      timeMax: `${fechaHastaExclusiva}T00:00:00-05:00`,
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'false',
      maxResults: '2500',
      timeZone,
    });
    if (pageToken) parametros.set('pageToken', pageToken);
    const respuesta = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${parametros}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => ({}));
      const error = new Error(detalle?.error?.message || `Google Calendar respondió con estado ${respuesta.status}.`);
      error.status = respuesta.status;
      throw error;
    }
    const datos = await respuesta.json();
    encontrados.push(...(datos.items || []).filter(item => item.status !== 'cancelled'));
    pageToken = datos.nextPageToken || '';
  } while (pageToken);
  return encontrados;
}
