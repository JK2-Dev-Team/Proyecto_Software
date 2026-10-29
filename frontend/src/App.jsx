import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Layout from './components/Layout';
import Login from './pages/Login';
import Ordenes from './pages/Ordenes';
import Citas from './pages/Citas';
import Inventario from './pages/Inventario';
import Clientes from './pages/Clientes';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RutaProtegida />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/ordenes" replace />} />
              <Route path="ordenes" element={<Ordenes />} />
              <Route path="citas" element={<Citas />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="usuarios" element={<Usuarios />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
