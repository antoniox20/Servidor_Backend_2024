const mongoose = require('mongoose');

const preguntaSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true
  },
  pregunta: {
    type: String,
    required: true
  },
  opciones: {
    type: [String],
    required: function() {
      return this.tipo !== 'listening';
    }
  },
  respuestaCorrecta: {
    type: String,
    required: true
  },
  dificultad: {
    type: String,
    required: true
  },
  libro: {
    type: String,
    required: true
  },
  audio: {
    type: String
  }
});

const Pregunta = mongoose.model('Pregunta', preguntaSchema);

module.exports = Pregunta;
