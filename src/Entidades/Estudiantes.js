const mongoose = require('mongoose');

const estudianteSchema = new mongoose.Schema({
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
  fechaDeNacimiento: { 
    type: Date, 
    required: true 
  },
  email: { 
    type: String,
    required: true,
    unique: true 
  },
  telefono: { 
    type: String 
  },
  nivel: {
    type: String,
    enum: ['basico', 'intermedio', 'avanzado'], 
    required: true
  },
  examenAsignado: {
    type: String, 
    default: null
  }
});

const Estudiante = mongoose.model('Estudiante', estudianteSchema);

module.exports = Estudiante;
