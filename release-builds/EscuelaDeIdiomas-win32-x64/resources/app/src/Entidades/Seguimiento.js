const mongoose = require('mongoose');

const seguimientoSchema = new mongoose.Schema({
    nombre: String,
    apellido: String,
    email: String,
    telefono: String,
    horaIngreso: Date
});

module.exports = mongoose.model('Seguimiento', seguimientoSchema);
