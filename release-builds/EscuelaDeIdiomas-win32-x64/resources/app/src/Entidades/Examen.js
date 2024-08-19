const mongoose = require('mongoose');

const ExamenSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  tema: { type: String, required: true },
  libro: { type: String, required: true },
  tipo: { type: String, required: true },
  incluyeImagenes: { type: Boolean, default: false },
  preguntas: [
    {
      pregunta: { type: String, required: true },
      opciones: [{ type: String, required: true }],
      respuestaCorrecta: { type: String, required: true },
      audioUrl: { type: String }
    }
  ],
  dificultad: { type: String, required: true },
  fechaCreacion: { type: Date, default: Date.now },
  token: { type: String, required: true },
  contenidoHTML: { type: String, required: true },
  tiempo: { type: Number, required: true } 
});

module.exports = mongoose.model('Examen', ExamenSchema);
