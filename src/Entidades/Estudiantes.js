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
  }
});

const Estudiante = mongoose.model('Estudiante', estudianteSchema);

module.exports = Estudiante;
