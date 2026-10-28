import { useEffect, useMemo, useState } from 'react';
import useCarga from '../hooks/useCarga';
import Modal from '../components/Modal';
import { Aviso, Campo, Vacio } from '../components/ui';
import { clientesService, ordenesService, procedimientosService } from '../services/services';
import { mensajeError } from '../services/api';
import { ESTADOS, TRANSICIONES, etiquetaEstado, formatoFecha, formatoFechaHora, soloFecha } from '../constants';

const FORM_VACIO = { cliente_id: '', tipo_procedimiento_id: '', unidades: 1, fecha_entrega_estimada: '', descripcion: '' };

function estaVencida(orden) {
  if (!orden.fecha_entrega_estimada || ['terminado', 'entregado'].includes(orden.estado)) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return soloFecha(orden.fecha_entrega_estimada) < hoy;
}

export default function Ordenes() {
  const { datos, cargando, error, recargar } = useCarga(async () => {
    const [ordenes, clientes, procedimientos] = await Promise.all([
      ordenesService.listar(),
      clientesService.listar(),
      procedimientosService.listar(),
    ]);
    return { ordenes, clientes, procedimientos };
  });

  const [aviso, setAviso] = useState('');
  const [moviendo, setMoviendo] = useState(null);
  const [creando, setCreando] = useState(false);
  const [detalleId, setDetalleId] = useState(null);

  const clientePorId = useMemo(() => new Map((datos?.clientes ?? []).map((c) => [c.id, c.nombre])), [datos]);
  const procPorId = useMemo(() => new Map((datos?.procedimientos ?? []).map((p) => [p.id, p.nombre])), [datos]);

  async function mover(orden, estado) {
    setAviso('');
    setMoviendo(orden.id);
    try {
      await ordenesService.cambiarEstado(orden.id, estado);
      await recargar();
    } catch (e) {
      // Incluye el caso "Stock insuficiente de ..." cuando el descuento de insumos falla.
      setAviso(mensajeError(e));
    } finally {
      setMoviendo(null);
    }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Órdenes de trabajo</h1>
        <button className="boton" onClick={() => setCreando(true)}>
          Nueva orden
        </button>
      </div>

      <Aviso onCerrar={() => setAviso('')}>{aviso}</Aviso>
      {error && <Aviso>{error}</Aviso>}
      {cargando && !datos && <p className="suave">Cargando órdenes…</p>}

      {datos && datos.ordenes.length === 0 && (
        <Vacio titulo="Todavía no hay órdenes">
          <p>Crea la primera para empezar a seguir su avance por el laboratorio.</p>
        </Vacio>
      )}

      {datos && datos.ordenes.length > 0 && (
        <div className="tablero">
          {ESTADOS.map((est) => {
            const lista = datos.ordenes.filter((o) => o.estado === est.id);
            return (
              <section key={est.id} className="etapa" aria-labelledby={`etapa-${est.id}`}>
                <header>
                  <h2 id={`etapa-${est.id}`}>{est.etiqueta}</h2>
                  <span className="conteo">{lista.length}</span>
                </header>
                <ul>
                  {lista.length === 0 && <li className="etapa-vacia">Sin órdenes</li>}
                  {lista.map((o) => (
                    <li key={o.id} className="orden">
                      <button type="button" className="orden-titulo" onClick={() => setDetalleId(o.id)}>
                        <span>Orden #{o.id}</span>
                        <strong>{clientePorId.get(o.cliente_id) ?? `Cliente ${o.cliente_id}`}</strong>
                      </button>
                      <p>
                        {procPorId.get(o.tipo_procedimiento_id) ?? 'Procedimiento'} · {o.unidades}{' '}
                        {o.unidades === 1 ? 'unidad' : 'unidades'}
                      </p>
                      <p className={estaVencida(o) ? 'vencida' : 'suave'}>
                        {estaVencida(o) ? 'Vencida: ' : 'Entrega: '}
                        {formatoFecha(o.fecha_entrega_estimada)}
                      </p>
                      <div className="acciones">
                        {TRANSICIONES[o.estado].map((sig, i) => (
                          <button
                            key={sig}
                            type="button"
                            className={i === 0 ? 'boton chico' : 'boton chico secundario'}
                            disabled={moviendo === o.id}
                            onClick={() => mover(o, sig)}
                          >
                            {i === 0 ? `Pasar a ${etiquetaEstado(sig).toLowerCase()}` : `Devolver a ${etiquetaEstado(sig).toLowerCase()}`}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <NuevaOrden
        abierto={creando}
        clientes={datos?.clientes ?? []}
        procedimientos={datos?.procedimientos ?? []}
        onCerrar={() => setCreando(false)}
        onCreada={async () => {
          setCreando(false);
          await recargar();
        }}
      />
      <DetalleOrden
        id={detalleId}
        onCerrar={() => setDetalleId(null)}
        cliente={(id) => clientePorId.get(id)}
        procedimiento={(id) => procPorId.get(id)}
      />
    </>
  );
}

function NuevaOrden({ abierto, clientes, procedimientos, onCerrar, onCreada }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  useEffect(() => {
    if (abierto) {
      setForm(FORM_VACIO);
      setError('');
    }
  }, [abierto]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await ordenesService.crear({
        cliente_id: Number(form.cliente_id),
        tipo_procedimiento_id: Number(form.tipo_procedimiento_id),
        unidades: Number(form.unidades),
        descripcion: form.descripcion.trim() || undefined,
        fecha_entrega_estimada: form.fecha_entrega_estimada || undefined,
      });
      await onCreada();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nueva orden de trabajo" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Cliente">
          <select value={form.cliente_id} onChange={set('cliente_id')} required>
            <option value="">Selecciona un cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Procedimiento">
          <select value={form.tipo_procedimiento_id} onChange={set('tipo_procedimiento_id')} required>
            <option value="">Selecciona un procedimiento</option>
            {procedimientos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>
        <div className="fila">
          <Campo etiqueta="Unidades" ayuda="Piezas que incluye el trabajo">
            <input type="number" min="1" step="1" value={form.unidades} onChange={set('unidades')} required />
          </Campo>
          <Campo etiqueta="Entrega estimada">
            <input type="date" value={form.fecha_entrega_estimada} onChange={set('fecha_entrega_estimada')} />
          </Campo>
        </div>
        <Campo etiqueta="Descripción">
          <textarea rows="3" value={form.descripcion} onChange={set('descripcion')} />
        </Campo>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Creando…' : 'Crear orden'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DetalleOrden({ id, onCerrar, cliente, procedimiento }) {
  const [orden, setOrden] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    setOrden(null);
    setError('');
    ordenesService
      .obtener(id)
      .then((o) => vivo && setOrden(o))
      .catch((e) => vivo && setError(mensajeError(e)));
    return () => {
      vivo = false;
    };
  }, [id]);

  return (
    <Modal abierto={Boolean(id)} titulo={`Orden #${id ?? ''}`} onCerrar={onCerrar}>
      <Aviso>{error}</Aviso>
      {!orden && !error && <p className="suave">Cargando…</p>}
      {orden && (
        <>
          <dl className="datos">
            <dt>Cliente</dt><dd>{cliente(orden.cliente_id) ?? orden.cliente_id}</dd>
            <dt>Procedimiento</dt><dd>{procedimiento(orden.tipo_procedimiento_id) ?? orden.tipo_procedimiento_id}</dd>
            <dt>Unidades</dt><dd>{orden.unidades}</dd>
            <dt>Entrega estimada</dt><dd>{formatoFecha(orden.fecha_entrega_estimada)}</dd>
            <dt>Estado actual</dt><dd>{etiquetaEstado(orden.estado)}</dd>
            {orden.descripcion && (<><dt>Descripción</dt><dd>{orden.descripcion}</dd></>)}
          </dl>
          <h3>Historial</h3>
          <ol className="historial">
            {orden.historial.map((h) => (
              <li key={h.id}>
                <strong>{etiquetaEstado(h.estado_nuevo)}</strong>
                <span className="suave">{formatoFechaHora(h.created_at)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Modal>
  );
}
