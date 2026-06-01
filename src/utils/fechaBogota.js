// Devuelve un Date ajustado a la zona horaria de Bogotá (UTC-5)
export function nowBogotaDate() {
  const utc = new Date();
  // Bogotá es UTC-5 todo el año (sin DST)
  const bogota = new Date(utc.getTime() - (utc.getTimezoneOffset() * 60000) - (5 * 60 * 60 * 1000));
  return bogota;
}

export function formatFechaBogota(date) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function esHoyBogota(date) {
  return formatFechaBogota(date) === formatFechaBogota(nowBogotaDate());
}
