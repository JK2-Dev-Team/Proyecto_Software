import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mensajeError } from '../services/api';
import { Aviso, Campo } from '../components/ui';

export default function Login() {
  const { usuario, entrar } = useAuth();
  const navigate = useNavigate();
  const ubicacion = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await entrar(email.trim(), password);
      navigate(ubicacion.state?.desde?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(
        err.response?.status === 401 ? 'El correo o la contraseña no coinciden.' : mensajeError(err)
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="login-tarjeta" onSubmit={enviar}>
        <h1>Laboratorio Dental Miguel Torres</h1>
        <p className="suave">Ingresa para gestionar órdenes, citas e inventario.</p>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Correo electrónico">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </Campo>
        <Campo etiqueta="Contraseña">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Campo>
        <button className="boton" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
