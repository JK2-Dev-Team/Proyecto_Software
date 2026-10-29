import api from './api';

const datos = (r) => r.data;

export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }).then(datos),
};

export const clientesService = {
  listar: () => api.get('/clientes').then(datos),
  crear: (d) => api.post('/clientes', d).then(datos),
};

export const procedimientosService = {
  listar: () => api.get('/procedimientos').then(datos),
};

export const citasService = {
  listar: (params) => api.get('/citas', { params }).then(datos),
  crear: (d) => api.post('/citas', d).then(datos),
  cambiarEstado: (id, estado) => api.patch(`/citas/${id}/estado`, { estado }).then(datos),
};

export const ordenesService = {
  listar: (params) => api.get('/ordenes', { params }).then(datos),
  obtener: (id) => api.get(`/ordenes/${id}`).then(datos),
  crear: (d) => api.post('/ordenes', d).then(datos),
  cambiarEstado: (id, estado) => api.patch(`/ordenes/${id}/estado`, { estado }).then(datos),
};

export const inventarioService = {
  listar: (params) => api.get('/inventario', { params }).then(datos),
  alertas: () => api.get('/inventario/alertas').then(datos),
  crear: (d) => api.post('/inventario', d).then(datos),
  movimiento: (id, d) => api.post(`/inventario/${id}/movimientos`, d).then(datos),
};

export const reportesService = {
  ordenes: (params) => api.get('/reportes/ordenes', { params }).then(datos),
  consumoInsumos: (params) => api.get('/reportes/consumo-insumos', { params }).then(datos),
  citas: (params) => api.get('/reportes/citas', { params }).then(datos),
};

export const usuariosService = {
  listar: () => api.get('/usuarios').then(datos),
  crear: (d) => api.post('/usuarios', d).then(datos),
  actualizar: (id, d) => api.patch(`/usuarios/${id}`, d).then(datos),
  restablecerPassword: (id, password) => api.put(`/usuarios/${id}/password`, { password }).then(datos),
};
