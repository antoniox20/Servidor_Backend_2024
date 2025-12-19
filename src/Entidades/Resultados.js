const mongoose = require('mongoose');

// Definición del esquema de resultados
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
  apellido2: {
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
  },
  horaInicio: {
    type: Date,
    required: true
  },
  horaFin: {
    type: Date
  },
  tiempoTranscurrido: {
    type: Number, 
    required: true
  },
  
  id_examen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Examen',  // Aquí referenciamos el modelo Examen
    required: true
  },

  titulo: {
    type: String,
    required: true
  }
});

// Crear el modelo Resultado
const Resultado = mongoose.model('Resultado', resultadoSchema);

module.exports = Resultado;
