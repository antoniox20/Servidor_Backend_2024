const mongoose = require('mongoose');

const registroSchema = new mongoose.Schema({
  examen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Examen',
    required: true
  },
  resultado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resultado',
    required: true
  },
  fechaRegistro: {
    type: Date,
    default: Date.now
  }
});

const Registro = mongoose.model('Registro', registroSchema);

module.exports = Registro;
