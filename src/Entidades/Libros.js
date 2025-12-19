const mongoose = require('mongoose');

const libroSchema = new mongoose.Schema({
  tomo: { 
    type: String, 
    required: true 
  },
  nivel: { 
    type: String,
    enum: ['basico', 'intermedio', 'avanzado'], 
    required: true 
  },
  tema: { 
    type: String, 
    required: true 
  }
});

const Libros = mongoose.model('Libros', libroSchema);

module.exports = Libros;
