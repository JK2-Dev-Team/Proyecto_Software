import { useEffect, useState } from 'react';
import useCarga from '../hooks/useCarga';
import Modal from '../components/Modal';
import { Aviso, Campo, Vacio } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { inventarioService } from '../services/services';
import { mensajeError } from '../services/api';
import { formatoNumero } from '../constants';

const TIPOS = [
  { id: 'entrada', texto: 'Entrada (compra o reposición)' },
  { id: 'salida', texto: 'Salida manual' },
];

export default function Inventario() {
  const { esAdmin } = useAuth();
  const [soloBajo, setSoloBajo] = useState(false);
  const { datos, cargando, error, recargar } = useCarga(
    () => inventarioService.listar(soloBajo ? { bajoStock: true } : undefined),
    [soloBajo]
  );
  const [movimiento, setMovimiento] = useState(null); // insumo seleccionado
  const [creando, setCreando] = useState(false);

  const bajos = (datos ?? []).filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo));

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Inventario</h1>
        {esAdmin && (
          <button className="boton" onClick={() => setCreando(true)}>Nuevo insumo</button>
        )}
      </div>

      {error && <Aviso>{error}</Aviso>}
      {!soloBajo && bajos.length > 0 && (
        <Aviso tipo="alerta">
          {bajos.length === 1
            ? `Stock bajo: ${bajos[0].nombre}. Conviene reponerlo pronto.`
            : `Stock bajo en ${bajos.length} insumos: ${bajos.map((b) => b.nombre).join(', ')}.`}
        </Aviso>
      )}

      <label className="interruptor">
        <input type="checkbox" checked={soloBajo} onChange={(e) => setSoloBajo(e.target.checked)} />
        Mostrar solo insumos con stock bajo
      </label>

      {cargando && !datos && <p className="suave">Cargando inventario…</p>}
      {datos && datos.length === 0 && (
        <Vacio titulo={soloBajo ? 'No hay insumos con stock bajo' : 'Aún no hay insumos registrados'}>
          {!soloBajo && <p>{esAdmin ? 'Agrega el primero con “Nuevo insumo”.' : 'Pide al administrador que registre los insumos.'}</p>}
        </Vacio>
      )}

      {datos && datos.length > 0 && (
        <div className="tabla-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="num">Stock actual</th>
                <th className="num">Mínimo</th>
                <th>Estado</th>
                <th><span className="oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((i) => {
                const bajo = Number(i.stock_actual) <= Number(i.stock_minimo);
                return (
                  <tr key={i.id}>
                    <td>{i.nombre}</td>
                    <td className="num">{formatoNumero(i.stock_actual)} {i.unidad}</td>
                    <td className="num">{formatoNumero(i.stock_minimo)} {i.unidad}</td>
                    <td><span className={bajo ? 'marca-estado bajo' : 'marca-estado ok'}>{bajo ? 'Stock bajo' : 'Suficiente'}</span></td>
                    <td className="derecha">
                      <button className="boton chico secundario" onClick={() => setMovimiento(i)}>Registrar movimiento</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MovimientoModal insumo={movimiento} onCerrar={() => setMovimiento(null)} onListo={async () => { setMovimiento(null); await recargar(); }} />
      <NuevoInsumo abierto={creando} onCerrar={() => setCreando(false)} onListo={async () => { setCreando(false); await recargar(); }} />
    </>
  );
}

function MovimientoModal({ insumo, onCerrar, onListo }) {
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (insumo) { setTipo('entrada'); setCantidad(''); setMotivo(''); setError(''); }
  }, [insumo]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await inventarioService.movimiento(insumo.id, { tipo, cantidad: Number(cantidad), motivo: motivo.trim() || undefined });
      await onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={Boolean(insumo)} titulo={insumo ? `Movimiento de ${insumo.nombre}` : ''} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Tipo de movimiento">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
          </select>
        </Campo>
        <Campo etiqueta={`Cantidad${insumo ? ` (${insumo.unidad})` : ''}`}>
          <input type="number" step="any" min="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Motivo">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: compra a proveedor, conteo físico" />
        </Campo>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar movimiento'}</button>
        </div>
      </form>
    </Modal>
  );
}

function NuevoInsumo({ abierto, onCerrar, onListo }) {
  const vacio = { nombre: '', unidad: '', stock_actual: 0, stock_minimo: 0 };
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  useEffect(() => { if (abierto) { setForm(vacio); setError(''); } }, [abierto]); // eslint-disable-line

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await inventarioService.crear({
        nombre: form.nombre,
        unidad: form.unidad,
        stock_actual: Number(form.stock_actual),
        stock_minimo: Number(form.stock_minimo),
      });
      await onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nuevo insumo" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Nombre"><input value={form.nombre} onChange={set('nombre')} required /></Campo>
        <Campo etiqueta="Unidad de medida" ayuda="Por ejemplo: g, ml, unidad">
          <input value={form.unidad} onChange={set('unidad')} required />
        </Campo>
        <div className="fila">
          <Campo etiqueta="Stock inicial"><input type="number" min="0" step="any" value={form.stock_actual} onChange={set('stock_actual')} required /></Campo>
          <Campo etiqueta="Stock mínimo" ayuda="Debajo de este valor se genera una alerta">
            <input type="number" min="0" step="any" value={form.stock_minimo} onChange={set('stock_minimo')} required />
          </Campo>
        </div>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Crear insumo'}</button>
        </div>
      </form>
    </Modal>
  );
}
