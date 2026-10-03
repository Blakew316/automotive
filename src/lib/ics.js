// iCalendar (.ics) export of appointments for Google Calendar, Apple Calendar and Outlook.
import { fullName, vehicleName } from './format';
import { PRODUCT } from '../brand/artwork';

const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 octets are folded with CRLF + space (RFC 5545 §3.1).
function fold(line) {
  const out = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function appointmentsIcs(state, { daysBack = 30, daysAhead = 120 } = {}) {
  const now = Date.now();
  const shop = state.shop;
  const location = [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(', ');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${PRODUCT}//Appointments//EN`, 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(`${shop.name} appointments`)}`];
  for (const a of state.appointments) {
    const start = new Date(a.start).getTime();
    if (start < now - daysBack * 86400000 || start > now + daysAhead * 86400000 || a.status === 'cancelled') continue;
    const c = state.customers.find((x) => x.id === a.customerId);
    const v = state.vehicles.find((x) => x.id === a.vehicleId);
    const tech = state.technicians.find((t) => t.id === a.techId);
    const desc = [v && vehicleName(v), c?.phone && `Phone: ${c.phone}`, tech && `Tech: ${tech.name}`, a.notes].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@autoshop-pro`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(start + (a.duration || 60) * 60000)}`,
      `SUMMARY:${esc(`${a.title || 'Appointment'} — ${fullName(c)}`)}`,
      `DESCRIPTION:${esc(desc)}`,
      `LOCATION:${esc(location)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}
