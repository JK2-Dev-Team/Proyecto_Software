import { useEffect, useState } from 'react';
import useCarga from '../hooks/useCarga';
import Modal from '../components/Modal';
import { Aviso, Campo, Vacio } from '../components/ui';
import { clientesService } from '../services/services';
import { mensajeError } from '../services/api';

export default function Clientes() {
  const { datos, cargando, error, recargar } = useCarga(() => clientesService.listar());
  const [creando, setCreando] = useState(false);

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Clientes</h1>
        <button className="boton" onClick={() => setCreando(true)}>Nuevo cliente</button>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {cargando && !datos && <p className="suave">Cargando clientes…</p>}
      {datos && datos.length === 0 && (
        <Vacio titulo="Aún no hay clientes">
          <p>Registra a los odontólogos y pacientes para poder crear citas y órdenes.</p>
        </Vacio>
      )}
      {datos && datos.length > 0 && (
        <div className="tabla-envoltorio">
          <table>
            <thead><tr><th>Nombre</th><th>Tipo</th><th>Teléfono</th><th>Correo</th></tr></thead>
            <tbody>
              {datos.map((c) => (
                <tr key={c.id}><td>{c.nombre}</td><td>{c.tipo === 'odontologo' ? 'Odontólogo' : 'Paciente'}</td><td>{c.telefono || '—'}</td><td>{c.email || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NuevoCliente abierto={creando} onCerrar={() => setCreando(false)} onListo={async () => { setCreando(false); await recargar(); }} />
    </>
  );
}

function NuevoCliente({ abierto, onCerrar, onListo }) {
  const [form, setForm] = useState({ nombre: '', tipo: 'odontologo', telefono: '', email: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  useEffect(() => { if (abierto) { setForm({ nombre: '', tipo: 'odontologo', telefono: '', email: '' }); setError(''); } }, [abierto]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await clientesService.crear({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      await onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nuevo cliente" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Nombre"><input value={form.nombre} onChange={set('nombre')} required /></Campo>
        <Campo etiqueta="Tipo de cliente">
          <select value={form.tipo} onChange={set('tipo')}>
            <option value="odontologo">Odontólogo</option>
            <option value="paciente">Paciente</option>
          </select>
        </Campo>
        <Campo etiqueta="Teléfono"><input type="tel" value={form.telefono} onChange={set('telefono')} /></Campo>
        <Campo etiqueta="Correo electrónico"><input type="email" value={form.email} onChange={set('email')} /></Campo>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cliente'}</button>
        </div>
      </form>
    </Modal>
  );
}
