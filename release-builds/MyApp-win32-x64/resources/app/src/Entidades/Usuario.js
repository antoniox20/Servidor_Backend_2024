const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true
  },
  ci: {
    type: Number,
    required: true
  },
  
  resetTokenExpiration: {
    type: Date,
    required: false
  }
  
});
const Usuario = mongoose.model('Usuario', userSchema);

module.exports = Usuario;


