const mongoose = require('mongoose');

const resultadoSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    required: true
  },
  apellido: {
    type: String,
    required: true
  },
  correctas: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  nota: {
    type: Number, 
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

const Resultado = mongoose.model('Resultado', resultadoSchema);

module.exports = Resultado;
