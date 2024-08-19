const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Usuario = require('./Entidades/Usuario'); 

// Conexión a la base de datos MongoDB
mongoose.connect('mongodb://localhost:27017/loginApp', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// credenciales del Administrador
async function createUsers() {
  const users = [
    { 
      username: 'admin', 
      password: await bcrypt.hash('12345', 10), 
      email: 'ataboadas_cb@est.edmi.edu.bo',
      ci: 1234567890,
      resetTokenExpiration: null 
    },
  ];

  try {
    await Usuario.insertMany(users);
    console.log('administrador creado');
  } catch (err) {
    console.error('Error al crear usuario:', err);
  } finally {
    mongoose.connection.close();
  }
}

createUsers();
