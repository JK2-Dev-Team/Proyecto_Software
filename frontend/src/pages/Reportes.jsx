import { useState } from 'react';
import useCarga from '../hooks/useCarga';
import { Aviso, Vacio } from '../components/ui';
import { reportesService } from '../services/services';
import { ESTADOS, ESTADOS_CITA, etiquetaEstado, formatoNumero } from '../constants';

/* ---------- Fechas (siempre como texto AAAA-MM-DD, igual que el backend) ---------- */

// "Hoy" según la hora de Colombia, aunque el navegador esté en otra zona.
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

function sumarDias(fecha, dias) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

const primeroDelMes = (fecha) => `${fecha.slice(0, 7)}-01`;
const ultimoDelMes = (fecha) => sumarDias(`${sumarDias(primeroDelMes(fecha), 32).slice(0, 7)}-01`, -1);

const PRESETS = [
  { id: 'mes', texto: 'Este mes', rango: (hoy) => ({ desde: primeroDelMes(hoy), hasta: hoy }) },
  {
    id: 'mes-anterior',
    texto: 'Mes anterior',
    rango: (hoy) => {
      const ultimo = sumarDias(primeroDelMes(hoy), -1);
      return { desde: primeroDelMes(ultimo), hasta: ultimoDelMes(ultimo) };
    },
  },
  { id: '30', texto: 'Últimos 30 días', rango: (hoy) => ({ desde: sumarDias(hoy, -29), hasta: hoy }) },
  { id: '90', texto: 'Últimos 90 días', rango: (hoy) => ({ desde: sumarDias(hoy, -89), hasta: hoy }) },
];

// Formato propio ("26 oct", "26 oct 2026"): toLocaleDateString varía entre navegadores ("26 de oct. de 2026").
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corta = (fecha) => `${Number(fecha.slice(8, 10))} ${MESES[Number(fecha.slice(5, 7)) - 1]}`;
const larga = (fecha) => `${corta(fecha)} ${fecha.slice(0, 4)}`;
const etiquetaSemana = (s) => `${corta(s.semana_inicio)} – ${corta(s.semana_fin)}`;

function validarRango({ desde, hasta }) {
  if (!desde || !hasta) return 'Elige la fecha inicial y la final.';
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la final.';
  if (hasta > sumarDias(desde, 365)) return 'El período no puede superar 366 días.';
  return '';
}

/* ---------- Página ---------- */

export default function Reportes() {
  const [preset, setPreset] = useState('mes');
  const [rango, setRango] = useState(() => PRESETS[0].rango(hoyBogota()));
  const problema = validarRango(rango);

  const { datos, cargando, error } = useCarga(
    () => {
      if (problema) return Promise.resolve(null);
      return Promise.all([
        reportesService.ordenes(rango),
        reportesService.consumoInsumos(rango),
        reportesService.citas(rango),
      ]).then(([ordenes, consumo, citas]) => ({ ordenes, consumo, citas }));
    },
    [rango.desde, rango.hasta]
  );

  function elegirPreset(p) {
    setPreset(p.id);
    setRango(p.rango(hoyBogota()));
  }

  function cambiarFecha(campo) {
    return (e) => {
      setPreset('');
      setRango((r) => ({ ...r, [campo]: e.target.value }));
    };
  }

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Reportes</h1>
      </div>

      <section className="periodo" aria-label="Período del reporte">
        <div className="presets" role="group" aria-label="Períodos rápidos">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`boton chico ${preset === p.id ? '' : 'secundario'}`}
              aria-pressed={preset === p.id}
              onClick={() => elegirPreset(p)}
            >
              {p.texto}
            </button>
          ))}
        </div>
        <div className="fechas">
          <label className="campo">
            <span>Desde</span>
            <input type="date" value={rango.desde} max={rango.hasta || undefined} onChange={cambiarFecha('desde')} />
          </label>
          <label className="campo">
            <span>Hasta</span>
            <input type="date" value={rango.hasta} min={rango.desde || undefined} onChange={cambiarFecha('hasta')} />
          </label>
        </div>
      </section>

      <Aviso>{problema || error}</Aviso>
      {cargando && !datos && !problema && <p className="suave">Calculando reportes…</p>}

      {datos && !problema && (
        <div className={cargando ? 'reportes actualizando' : 'reportes'}>
          <p className="suave rotulo-periodo">
            Del {larga(rango.desde)} al {larga(rango.hasta)}
          </p>
          <Resumen {...datos} />
          <OrdenesPorEstado reporte={datos.ordenes} />
          <OrdenesPorCliente reporte={datos.ordenes} />
          <ConsumoInsumos reporte={datos.consumo} />
          <CitasPorSemana reporte={datos.citas} />
        </div>
      )}
    </>
  );
}

/* ---------- Bloques ---------- */

function Resumen({ ordenes, consumo, citas }) {
  const terminadas = ordenes.por_estado.filter((e) => e.estado === 'terminado' || e.estado === 'entregado').reduce((a, e) => a + e.total, 0);
  const canceladas = citas.semanas.reduce((a, s) => a + s.cancelada, 0);
  return (
    <div className="resumen">
      <Dato valor={ordenes.total} texto="Órdenes creadas" detalle={`${terminadas} terminadas o entregadas`} />
      <Dato valor={consumo.insumos.length} texto="Insumos con salidas" detalle="consumo en órdenes y salidas manuales" />
      <Dato valor={citas.total} texto="Citas programadas" detalle={`${canceladas} canceladas`} />
    </div>
  );
}

function Dato({ valor, texto, detalle }) {
  return (
    <div className="dato">
      <strong>{formatoNumero(valor)}</strong>
      <span>{texto}</span>
      <small>{detalle}</small>
    </div>
  );
}

function Bloque({ titulo, ayuda, children }) {
  return (
    <section className="bloque-reporte">
      <h2>{titulo}</h2>
      {ayuda && <p className="suave">{ayuda}</p>}
      {children}
    </section>
  );
}

function OrdenesPorEstado({ reporte }) {
  const max = Math.max(1, ...reporte.por_estado.map((e) => e.total));
  return (
    <Bloque titulo="Órdenes por estado" ayuda="Estado actual de las órdenes creadas en el período.">
      {reporte.total === 0 ? (
        <Vacio titulo="No hay órdenes en este período" />
      ) : (
        <ul className="barras">
          {reporte.por_estado.map((e) => (
            <li key={e.estado}>
              <span className="barra-etiqueta">{etiquetaEstado(e.estado)}</span>
              <span className="barra-pista" aria-hidden="true">
                <span className="barra-relleno" style={{ width: `${(e.total / max) * 100}%` }} />
              </span>
              <span className="barra-valor">{e.total}</span>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}

function OrdenesPorCliente({ reporte }) {
  return (
    <Bloque titulo="Órdenes por cliente">
      {reporte.por_cliente.length === 0 ? (
        <Vacio titulo="Ningún cliente tiene órdenes en este período" />
      ) : (
        <div className="tabla-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                {ESTADOS.map((e) => <th key={e.id} className="num">{e.etiqueta}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {reporte.por_cliente.map((c) => (
                <tr key={c.cliente_id}>
                  <td>{c.cliente}</td>
                  {ESTADOS.map((e) => (
                    <td key={e.id} className={c.estados[e.id] ? 'num' : 'num cero'}>{c.estados[e.id]}</td>
                  ))}
                  <td className="num total">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bloque>
  );
}

function ConsumoInsumos({ reporte }) {
  return (
    <Bloque
      titulo="Consumo de insumos"
      ayuda="Salidas de inventario: las descontadas automáticamente por las órdenes y las registradas a mano."
    >
      {reporte.insumos.length === 0 ? (
        <Vacio titulo="No hubo salidas de insumos en este período" />
      ) : (
        <div className="tabla-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="num">Total consumido</th>
                <th className="num">En órdenes</th>
                <th className="num">Salidas manuales</th>
                <th className="num">Órdenes</th>
              </tr>
            </thead>
            <tbody>
              {reporte.insumos.map((i) => (
                <tr key={i.insumo_id}>
                  <td>{i.insumo}</td>
                  <td className="num total">{formatoNumero(i.total_consumido)} {i.unidad}</td>
                  <td className="num">{formatoNumero(i.consumo_ordenes)} {i.unidad}</td>
                  <td className="num">{formatoNumero(i.salidas_manuales)} {i.unidad}</td>
                  <td className="num">{i.ordenes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bloque>
  );
}

function CitasPorSemana({ reporte }) {
  const max = Math.max(1, ...reporte.semanas.map((s) => s.total));
  return (
    <Bloque titulo="Citas por semana" ayuda="Las semanas van de lunes a domingo; en las semanas de los extremos solo se cuentan los días del período.">
      {reporte.total === 0 ? (
        <Vacio titulo="No hay citas en este período" />
      ) : (
        <div className="tabla-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Semana</th>
                <th aria-label="Gráfico"></th>
                <th className="num">Total</th>
                {Object.entries(ESTADOS_CITA).map(([id, texto]) => <th key={id} className="num">{texto}</th>)}
              </tr>
            </thead>
            <tbody>
              {reporte.semanas.map((s) => (
                <tr key={s.semana_inicio}>
                  <td className="nowrap">{etiquetaSemana(s)}</td>
                  <td className="celda-barra">
                    <span className="barra-pista" aria-hidden="true">
                      <span className="barra-relleno" style={{ width: `${(s.total / max) * 100}%` }} />
                    </span>
                  </td>
                  <td className="num total">{s.total}</td>
                  {Object.keys(ESTADOS_CITA).map((id) => (
                    <td key={id} className={s[id] ? 'num' : 'num cero'}>{s[id]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bloque>
  );
}
