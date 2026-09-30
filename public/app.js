import { DIAS, EVENTO } from './config.js';
import { crearStore, turnoPorId, LlenoError } from './store.js';

const KEY_RESERVA = 'padel-reserva';

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
document.getElementById('titulo').textContent = EVENTO.titulo;
document.getElementById('bajada').textContent = EVENTO.bajada;

const estado = {
  store: null,
  ocupados: {},
  cargando: true,
  enviando: false,
  reserva: leerReserva(),
  cambiando: false,
  confirmandoBaja: false,
  diaSel: null,
  turnoSel: null,
};

// ── helpers ──────────────────────────────────────────────────

function leerReserva() {
  try {
    return localStorage.getItem(KEY_RESERVA);
  } catch {
    return null;
  }
}

function guardarReserva(id) {
  try {
    if (id) localStorage.setItem(KEY_RESERVA, id);
    else localStorage.removeItem(KEY_RESERVA);
  } catch {}
}

const horaFin = (hora) => `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}${hora.slice(2)}`;
const libres = (t) => Math.max(0, t.cupo - (estado.ocupados[t.id] || 0));
const turnosDe = (dia) => dia.horarios.map((h) => turnoPorId(`${dia.id}-${h.hora.replace(':', '')}`));

// Un turno ya no se ofrece cuando empezó.
function yaPaso(dia, hora) {
  const [a, m, d] = dia.id.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, hh, mm) <= new Date();
}

const turnosVigentes = (dia) => turnosDe(dia).filter((t) => !yaPaso(dia, t.hora));
const libresDia = (dia) => turnosVigentes(dia).reduce((s, t) => s + libres(t), 0);
const diasVigentes = () => DIAS.filter((d) => turnosVigentes(d).length > 0);

function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($toast.hidden = true), 4000);
}

const WA_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2m0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.23 8.23m4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.28"/></svg>`;

// ── vistas ───────────────────────────────────────────────────

const PELOTA = `<svg class="pelota-ok" viewBox="-25 -25 50 50" aria-hidden="true"><circle r="23" fill="#d8f03c"/><path d="M-17-15c9 8 9 22 0 30M17-15c-9 8-9 22 0 30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;

function vistaListo() {
  const t = turnoPorId(estado.reserva);
  const acciones = estado.confirmandoBaja
    ? `<div class="baja-confirmar">
        <p>¿Seguro? Liberás tu lugar del ${t.dia.nombre.toLowerCase()} a las ${t.hora} y otra persona lo puede tomar.</p>
        <div class="baja-botones">
          <button class="btn-baja" data-accion="baja-si" ${estado.enviando ? 'disabled' : ''}>${estado.enviando ? 'Liberando…' : 'Sí, desinscribirme'}</button>
          <button class="btn-link" data-accion="baja-no">No, me quedo</button>
        </div>
      </div>`
    : `<div class="acciones-listo">
        <button class="btn-link" data-accion="cambiar">Cambiar de horario</button>
        <button class="btn-link" data-accion="baja">Desinscribirme</button>
      </div>`;

  return `
    <section class="card listo">
      ${PELOTA}
      <h2>¡Estás anotado!</h2>
      <p class="turno-grande">${t.dia.nombre} ${t.dia.fecha}<strong>${t.hora} a ${horaFin(t.hora)} h</strong></p>
      <p class="paso">Último paso: sumate al grupo de WhatsApp de tu turno. Ahí se pasa toda la info.</p>
      <a class="btn-wa" href="${t.whatsapp}" target="_blank" rel="noopener">${WA_ICON} Unirme al grupo</a>
      <p class="nota">Si cerrás esto, volvé a escanear el QR desde este mismo celular y vas a ver tu grupo.</p>
      ${acciones}
    </section>`;
}

function vistaElegir() {
  const dias = diasVigentes();
  if (dias.length === 0) {
    return `<section class="card"><h2>Inscripción cerrada</h2><p>Ya pasaron todas las fechas. ¡Gracias!</p></section>`;
  }

  const findes = [...new Set(dias.map((d) => d.finde))];
  const bloquesDias = findes
    .map((f) => {
      const ds = dias.filter((d) => d.finde === f);
      return `
      <div class="finde">
        <h3>${f}º fin de semana <span>${ds[0].fecha} – ${ds[ds.length - 1].fecha}</span></h3>
        <div class="dias">
          ${ds
            .map((d) => {
              const l = libresDia(d);
              const sel = estado.diaSel === d.id;
              return `<button class="dia${sel ? ' sel' : ''}" data-dia="${d.id}" ${l === 0 ? 'disabled' : ''} aria-pressed="${sel}">
                <span class="dia-nombre">${d.nombre}</span>
                <span class="dia-fecha">${d.fecha}</span>
                <span class="dia-libres">${l === 0 ? 'Completo' : `${l} lugares`}</span>
              </button>`;
            })
            .join('')}
        </div>
      </div>`;
    })
    .join('');

  const dia = DIAS.find((d) => d.id === estado.diaSel);
  const bloqueTurnos = dia
    ? `
    <section class="card turnos" id="turnos">
      <h2><span class="num-paso">2</span>${dia.nombre} ${dia.fecha} · horario</h2>
      ${turnosVigentes(dia)
        .map((t) => {
          const l = libres(t);
          const pct = Math.round(((t.cupo - l) / t.cupo) * 100);
          const sel = estado.turnoSel === t.id;
          const actual = estado.reserva === t.id;
          return `<button class="turno${sel ? ' sel' : ''}" data-turno="${t.id}" ${l === 0 || actual ? 'disabled' : ''} aria-pressed="${sel}">
            <span class="turno-hora">${t.hora} – ${horaFin(t.hora)}</span>
            <span class="turno-libres ${l <= 5 ? 'pocos' : ''}">${actual ? 'Tu turno actual' : l === 0 ? 'Completo' : `Quedan ${l}`}</span>
            <span class="barra"><span style="width:${pct}%"></span></span>
          </button>`;
        })
        .join('')}
    </section>`
    : '';

  const t = estado.turnoSel && turnoPorId(estado.turnoSel);
  const barra = t
    ? `<div class="confirmar">
        <button class="btn-primario" data-accion="confirmar" ${estado.enviando ? 'disabled' : ''}>
          ${estado.enviando ? 'Reservando…' : `Reservar ${t.dia.nombre} ${t.dia.fecha} · ${t.hora} h`}
        </button>
      </div>`
    : '';

  const aviso = estado.cambiando
    ? `<div class="aviso">Estás cambiando tu turno. Si reservás otro, liberás el anterior.
         <button class="btn-link" data-accion="cancelar-cambio">Volver</button></div>`
    : '';

  const demo = estado.store?.demo
    ? `<p class="demo">Modo demo: los cupos se guardan sólo en este navegador.</p>`
    : '';

  return `${aviso}
    <section class="card">
      <h2><span class="num-paso">1</span>Elegí el día</h2>
      ${bloquesDias}
    </section>
    ${bloqueTurnos}
    ${barra}
    ${demo}`;
}

function render() {
  if (estado.cargando) return;
  const reservaValida = estado.reserva && turnoPorId(estado.reserva);
  $app.innerHTML = reservaValida && !estado.cambiando ? vistaListo() : vistaElegir();
  $app.classList.toggle('con-barra', !!estado.turnoSel);
}

// ── acciones ─────────────────────────────────────────────────

async function refrescar() {
  try {
    estado.ocupados = await estado.store.leer();
  } catch (e) {
    console.error(e);
    toast('No pudimos cargar los cupos. Revisá tu conexión.');
  }
}

async function confirmar() {
  const turno = turnoPorId(estado.turnoSel);
  if (!turno || estado.enviando) return;
  estado.enviando = true;
  render();
  try {
    const anterior = estado.cambiando ? estado.reserva : null;
    await estado.store.reservar(turno, anterior);
    estado.reserva = turno.id;
    guardarReserva(turno.id);
    estado.cambiando = false;
    estado.turnoSel = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    if (e instanceof LlenoError) {
      toast('Justo se llenó ese horario. Elegí otro.');
    } else {
      console.error(e);
      toast('Algo falló. Probá de nuevo en unos segundos.');
    }
    estado.turnoSel = null;
  } finally {
    estado.enviando = false;
    await refrescar();
    render();
  }
}

async function desinscribir() {
  if (!estado.reserva || estado.enviando) return;
  estado.enviando = true;
  render();
  try {
    await estado.store.cancelar(estado.reserva);
    estado.reserva = null;
    guardarReserva(null);
    estado.diaSel = null;
    estado.turnoSel = null;
    toast('Listo, liberaste tu lugar. Si querés, podés elegir otro turno.');
  } catch (e) {
    console.error(e);
    toast('No se pudo desinscribir. Probá de nuevo en unos segundos.');
  } finally {
    estado.enviando = false;
    estado.confirmandoBaja = false;
    await refrescar();
    render();
  }
}

$app.addEventListener('click', (ev) => {
  const el = ev.target.closest('button');
  if (!el || el.disabled) return;

  if (el.dataset.dia) {
    estado.diaSel = el.dataset.dia;
    estado.turnoSel = null;
    render();
    document.getElementById('turnos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (el.dataset.turno) {
    estado.turnoSel = el.dataset.turno;
    render();
  } else if (el.dataset.accion === 'confirmar') {
    confirmar();
  } else if (el.dataset.accion === 'cambiar') {
    estado.cambiando = true;
    estado.diaSel = null;
    estado.turnoSel = null;
    refrescar().then(render);
    render();
  } else if (el.dataset.accion === 'baja') {
    estado.confirmandoBaja = true;
    render();
  } else if (el.dataset.accion === 'baja-no') {
    estado.confirmandoBaja = false;
    render();
  } else if (el.dataset.accion === 'baja-si') {
    desinscribir();
  } else if (el.dataset.accion === 'cancelar-cambio') {
    estado.cambiando = false;
    estado.turnoSel = null;
    render();
  }
});

// ── arranque ─────────────────────────────────────────────────

(async () => {
  try {
    estado.store = await crearStore();
    await refrescar();
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<section class="card"><h2>No se pudo conectar</h2><p>Revisá tu conexión y recargá la página.</p></section>`;
    return;
  }
  estado.cargando = false;
  render();
})();
