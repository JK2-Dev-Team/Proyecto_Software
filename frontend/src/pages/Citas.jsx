import { useEffect, useMemo, useState } from 'react';
import useCarga from '../hooks/useCarga';
import Modal from '../components/Modal';
import { Aviso, Campo, Vacio } from '../components/ui';
import { citasService, clientesService } from '../services/services';
import { mensajeError } from '../services/api';
import { ACCION_CITA, ESTADOS_CITA, TRANSICIONES_CITA, formatoFechaHora } from '../constants';

export default function Citas() {
  const [filtro, setFiltro] = useState('');
  const { datos, cargando, error, recargar } = useCarga(async () => {
    const [citas, clientes] = await Promise.all([
      citasService.listar(filtro ? { estado: filtro } : undefined),
      clientesService.listar(),
    ]);
    return { citas, clientes };
  }, [filtro]);

  const [aviso, setAviso] = useState('');
  const [creando, setCreando] = useState(false);
  const clientePorId = useMemo(() => new Map((datos?.clientes ?? []).map((c) => [c.id, c.nombre])), [datos]);
  const citas = useMemo(() => [...(datos?.citas ?? [])].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)), [datos]);

  async function cambiar(cita, estado) {
    setAviso('');
    try {
      await citasService.cambiarEstado(cita.id, estado);
      await recargar();
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Citas</h1>
        <button className="boton" onClick={() => setCreando(true)}>Nueva cita</button>
      </div>

      <label className="campo filtro">
        <span>Filtrar por estado</span>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todas</option>
          {Object.entries(ESTADOS_CITA).map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </select>
      </label>

      <Aviso onCerrar={() => setAviso('')}>{aviso}</Aviso>
      {error && <Aviso>{error}</Aviso>}
      {cargando && !datos && <p className="suave">Cargando citas…</p>}

      {datos && citas.length === 0 && (
        <Vacio titulo={filtro ? 'No hay citas con ese estado' : 'No hay citas agendadas'}>
          {!filtro && <p>Agenda la primera con “Nueva cita”.</p>}
        </Vacio>
      )}

      {citas.length > 0 && (
        <div className="tabla-envoltorio">
          <table>
            <thead>
              <tr><th>Fecha y hora</th><th>Cliente</th><th>Motivo</th><th>Notas</th><th>Estado</th><th><span className="oculto">Acciones</span></th></tr>
            </thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id}>
                  <td>{formatoFechaHora(c.fecha_hora)}</td>
                  <td>{clientePorId.get(c.cliente_id) ?? c.cliente_id}</td>
                  <td>{c.motivo}</td>
                  <td className="suave">{c.notas || '—'}</td>
                  <td><span className={`marca-estado cita-${c.estado}`}>{ESTADOS_CITA[c.estado] ?? c.estado}</span></td>
                  <td className="derecha acciones">
                    {(TRANSICIONES_CITA[c.estado] ?? []).map((sig) => (
                      <button key={sig} className={sig === 'cancelada' ? 'boton chico texto' : 'boton chico secundario'} onClick={() => cambiar(c, sig)}>
                        {ACCION_CITA[sig]}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NuevaCita
        abierto={creando}
        clientes={datos?.clientes ?? []}
        onCerrar={() => setCreando(false)}
        onCreada={async () => { setCreando(false); await recargar(); }}
      />
    </>
  );
}

function NuevaCita({ abierto, clientes, onCerrar, onCreada }) {
  const [form, setForm] = useState({ cliente_id: '', fecha_hora: '', motivo: '', notas: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  useEffect(() => { if (abierto) { setForm({ cliente_id: '', fecha_hora: '', motivo: '', notas: '' }); setError(''); } }, [abierto]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await citasService.crear({
        cliente_id: Number(form.cliente_id),
        fecha_hora: new Date(form.fecha_hora).toISOString(),
        motivo: form.motivo.trim(),
        notas: form.notas.trim() || undefined,
      });
      await onCreada();
    } catch (err) {
      // Ej.: el cliente ya tiene una cita a esa hora.
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nueva cita" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Cliente">
          <select value={form.cliente_id} onChange={set('cliente_id')} required>
            <option value="">Selecciona un cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Fecha y hora"><input type="datetime-local" value={form.fecha_hora} onChange={set('fecha_hora')} required /></Campo>
        <Campo etiqueta="Motivo" ayuda="Por ejemplo: toma de impresión, prueba de metal"><input value={form.motivo} onChange={set('motivo')} required /></Campo>
        <Campo etiqueta="Notas"><textarea rows="3" value={form.notas} onChange={set('notas')} /></Campo>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Agendando…' : 'Agendar cita'}</button>
        </div>
      </form>
    </Modal>
  );
}
