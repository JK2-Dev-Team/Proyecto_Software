import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida() {
  const { usuario } = useAuth();
  const ubicacion = useLocation();
  return usuario ? <Outlet /> : <Navigate to="/login" replace state={{ desde: ubicacion }} />;
}
