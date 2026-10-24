
const aplicacion = require('./app');

const puerto = process.env.PORT || 3000;

aplicacion.listen(puerto, () => {
    console.log(`Servidor funcionando en http://localhost:${puerto}`);
});
