const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Usuario = require('./Entidades/Usuario');
const Estudiante = require('./Entidades/Estudiantes');
const Examen = require('./Entidades/Examen');
const { generateQuestions } = require('./generacion');
const Pregunta = require('./Entidades/Preguntas');
const Resultado = require('./Entidades/Resultados'); 
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io'); 
const appExpress = express();
const server = http.createServer(appExpress); 
const io = socketIO(server); 
const PORT = 3000;
const cors = require('cors'); 
const { verificarTokenPersonalizado } = require('./VerificarToken');
const { generarTokenPersonalizado, generarPalabrasClave } = require('./GeneracionToken');

// carpeta uploads 
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configuración de almacenamiento multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Configura CORS para permitir solicitudes desde http://localhost:8100
//appExpress.use(cors({
  //origin: 'http://localhost:8100'
//}));

// Si deseas permitir solicitudes desde cualquier origen, puedes usar:
appExpress.use(cors());


const upload = multer({ storage: storage });

// Coneccion a MongoDB para loginApp
//mongoose.connect('mongodb://localhost:27017/loginApp', { useNewUrlParser: true, useUnifiedTopology: true })
  //.then(() => console.log('Conectado a MongoDB para loginApp'))
//  .catch(err => console.error('Error al conectar a MongoDB:', err));

mongoose.connect('mongodb+srv://antoniotaboada777:0ZJ1alGXsIqPOzln@cluster0.kxioi.mongodb.net/loginApp?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB para loginApp'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// Middleware para Express
appExpress.use(bodyParser.json());
appExpress.use(bodyParser.urlencoded({ extended: true }));
appExpress.use('/uploads', express.static('uploads'));

// Configuración de socket.io
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Iniciar servidor Express con soporte de sockets
server.listen(PORT, () => {
  console.log(`Servidor Express con socket.io corriendo en http://localhost:${PORT}`);
});

// preguntas con carga de audio
appExpress.post('/preguntas', upload.single('audio'), async (req, res) => {
  const { tipo, pregunta, opciones, respuestaCorrecta, dificultad } = req.body;
  const audio = req.file ? req.file.path : undefined;

  const nuevaPregunta = new Pregunta({
    tipo,
    pregunta,
    opciones: tipo !== 'listening' ? opciones.split(',') : undefined,
    respuestaCorrecta,
    dificultad,
    audio
  });

  try {
    await nuevaPregunta.save();
    res.status(201).send('Pregunta registrada exitosamente');
  } catch (err) {
    console.error('Error al registrar la pregunta:', err);
    res.status(400).send('Error al registrar la pregunta');
  }
});


// Calificar examen y guardar resultado
appExpress.post('/calificarExamen', async (req, res) => {
  const { token, nombre, apellido, respuestas } = req.body;

  try {
    console.log('Datos recibidos:', { token, respuestas });

    let correctas = 0;

    const detalles = respuestas.map((respuesta, index) => {
      const esCorrecta = respuesta.respuestaSeleccionada === respuesta.respuestaCorrecta;
      if (esCorrecta) correctas++;
      return `
        <div class="detalle">
          <strong>Pregunta ${index + 1}:</strong> ${respuesta.pregunta}<br>
          <strong>Tu respuesta:</strong> ${respuesta.respuestaSeleccionada} (${esCorrecta ? 'Correcta' : 'Incorrecta'})<br>
          <strong>Respuesta correcta:</strong> ${respuesta.respuestaCorrecta}
        </div>
      `;
    }).join('');

    const total = respuestas.length;
    const nota = parseFloat(((correctas / total) * 10).toFixed(2)); 

    const nuevoResultado = new Resultado({
      token,
      nombre,
      apellido,
      correctas,
      total,
      nota 
    });

    await nuevoResultado.save();

    console.log('Examen calificado:', { correctas, total, nota, detalles });

    res.send({ correctas, total, nota, detalles });
  } catch (error) {
    console.error('Error al calificar el examen:', error);
    res.status(500).send('Error al calificar el examen');
  }
});

//Recuperar notas
appExpress.get('/obtenerResultados', async (req, res) => {
  try {
    const resultados = await Resultado.find();
    res.json(resultados);
  } catch (error) {
    console.error('Error al obtener los resultados:', error);
    res.status(500).send('Error al obtener los resultados');
  }
});

// Eliminar examen
appExpress.delete('/eliminarExamen/:id', async (req, res) => {
  const examenId = req.params.id;

  try {
    await Resultado.findByIdAndDelete(examenId);
    res.send({ message: 'Examen eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar el examen:', error);
    res.status(500).send('Error al eliminar el examen');
  }
});


// Rutas para examenes
appExpress.post('/generarExamen', async (req, res) => {
  const { titulo, descripcion, tema, libro, tiposPreguntas, numeroOpciones, dificultad, contenidoHTML, fechaCreacion, tiempo } = req.body;

  console.log('Datos recibidos:', req.body);

  const { preguntas, token, creationTime, expiresAt, palabrasClave } = generateQuestions(tema, tiposPreguntas, numeroOpciones, dificultad);

  if (!preguntas || preguntas.length === 0) {
    console.error('Error al generar preguntas: No se generaron preguntas');
    return res.status(400).send('Error al generar preguntas: No se generaron preguntas');
  }

  const preguntasConAudios = preguntas.map((pregunta, index) => {
    let nivel;
    switch (dificultad) {
      case 'basico':
        nivel = 'audio_basico';
        break;
      case 'intermedio':
        nivel = 'audio_intermedio';
        break;
      case 'avanzado':
        nivel = 'audio_avanzado';
        break;
      default:
        nivel = 'audio_basico';
    }

    return {
      ...pregunta,
      audioUrl: `./audios/${nivel}${index + 1}.mp3`
    };
  });

  console.log('Preguntas con audios:', preguntasConAudios);

  const nuevoExamen = new Examen({
    titulo,
    descripcion,
    tema,
    libro,
    tipo: tiposPreguntas.join(','),
    incluyeImagenes: false,
    preguntas: preguntasConAudios,
    dificultad,
    token,
    contenidoHTML,
    fechaCreacion: fechaCreacion ? new Date(fechaCreacion) : new Date(),
    tiempo: parseInt(tiempo, 10) * 60, // Convertir minutos a segundos
    expiresAt,
    palabrasClave
  });

  try {
    await nuevoExamen.save();
    res.json({ message: 'Examen generado exitosamente', preguntas: preguntasConAudios, token, contenidoHTML, tiempo: nuevoExamen.tiempo });
  } catch (err) {
    console.error('Error al guardar el examen:', err);
    res.status(400).send(`Error al guardar el examen: ${err.message}`);
  }
});

appExpress.post('/verificarToken', async (req, res) => {
  const { token } = req.body;

  try {
    const examen = await Examen.findOne({ token });

    if (!examen) {
      return res.status(400).json({ message: 'Token no válido o expirado' });
    }

    const now = new Date();
    if (now > new Date(examen.expiresAt)) {
      return res.status(400).json({ message: 'Token no válido o expirado' });
    }

    res.json({ message: 'Token válido', examen });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el examen', error });
  }
});


appExpress.delete('/examenes/:id', async (req, res) => {
  try {
    await Examen.findByIdAndDelete(req.params.id);
    res.status(200).send('Examen eliminado exitosamente');
  } catch (err) {
    console.error('Error al eliminar el examen:', err);
    res.status(500).send('Error al eliminar el examen');
  }
});

appExpress.get('/examenes', async (req, res) => {
  try {
    const examenes = await Examen.find();
    res.json(examenes);
  } catch (err) {
    console.error('Error al obtener los exámenes:', err);
    res.status(500).send('Error al obtener los exámenes');
  }
});

appExpress.put('/examenes/:id', async (req, res) => {
  const { titulo, descripcion, tema, tipo, preguntas, dificultad } = req.body;
  try {
    const examen = await Examen.findByIdAndUpdate(req.params.id, {
      titulo, descripcion, tema, tipo, preguntas, dificultad
    }, { new: true });
    res.status(200).json(examen);
  } catch (err) {
    console.error('Error al actualizar el examen:', err);
    res.status(500).send('Error al actualizar el examen');
  }
});


appExpress.get('/examenes/:token', async (req, res) => {
  try {
      const examen = await Examen.findOne({ token: req.params.token });
      if (!examen) {
          return res.status(404).send('Examen no encontrado');
      }
      res.json(examen);
  } catch (err) {
      console.error('Error al obtener el examen:', err);
      res.status(500).send('Error al obtener el examen');
  }
});

// Rutas para manejo de preguntas
appExpress.get('/preguntas', async (req, res) => {
  try {
    const preguntas = await Pregunta.find();
    res.json(preguntas);
  } catch (err) {
    console.error('Error al obtener las preguntas:', err);
    res.status(500).send('Error al obtener las preguntas');
  }
});

appExpress.post('/preguntas', upload.single('audio'), async (req, res) => {
  const { tipo, pregunta, opciones, respuestaCorrecta, dificultad, tema, fechaExamen } = req.body;
  const audio = req.file ? req.file.path : undefined;

  const nuevaPregunta = new Pregunta({
    tipo,
    pregunta,
    opciones: tipo !== 'listening' ? opciones.split(',') : undefined,
    respuestaCorrecta,
    dificultad,
    tema,
    audio,
    fechaExamen: fechaExamen ? new Date(fechaExamen) : new Date()
  });

  try {
    await nuevaPregunta.save();
    res.status(201).send('Pregunta registrada exitosamente');
  } catch (err) {
    console.error('Error al registrar la pregunta:', err);
    res.status(400).send('Error al registrar la pregunta');
  }
});

appExpress.delete('/preguntas/:id', async (req, res) => {
  try {
    await Pregunta.findByIdAndDelete(req.params.id);
    res.status(200).send('Pregunta eliminada exitosamente');
  } catch (err) {
    console.error('Error al eliminar la pregunta:', err);
    res.status(500).send('Error al eliminar la pregunta');
  }
});


function createExamenWindow() {
  const examenWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Examen Generado',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  examenWindow.setMenu(null);
  examenWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/ExamenGenerado.html'),
    protocol: 'file:',
    slashes: true
  }));
  examenWindow.on('closed', () => {
    examenWindow = null;
  });
}

ipcMain.on('open-examen-window', () => {
  createExamenWindow();
});

// Rutas para manejo de estudiantes
appExpress.get('/estudiantes', async (req, res) => {
  try {
    const estudiantes = await Estudiante.find();
    res.json(estudiantes);
  } catch (err) {
    console.error('Error al obtener la lista de estudiantes:', err);
    res.status(500).send('Error al obtener la lista de estudiantes');
  }
});

appExpress.get('/estudiantes/:id', async (req, res) => {
  try {
    const estudiante = await Estudiante.findById(req.params.id);
    res.json(estudiante);
  } catch (err) {
    console.error('Error al obtener los datos del estudiante:', err);
    res.status(500).send('Error al obtener los datos del estudiante');
  }
});

appExpress.post('/registro', async (req, res) => {
  const { nombre, apellido, apellido2, fechaDeNacimiento, email, telefono } = req.body;

  const nuevoEstudiante = new Estudiante({
    nombre,
    apellido,
    apellido2,
    fechaDeNacimiento,
    email,
    telefono
  });

  try {
    await nuevoEstudiante.save();
    res.status(201).send('Estudiante registrado exitosamente');
  } catch (err) {
    console.error('Error al registrar al estudiante:', err);
    res.status(400).send('Error al registrar al estudiante');
  }
});

appExpress.put('/estudiantes/:id', async (req, res) => {
  const { nombre, apellido, apellido2, fechaDeNacimiento, email, telefono } = req.body;
  try {
    const estudiante = await Estudiante.findByIdAndUpdate(req.params.id, {
      nombre,
      apellido,
      apellido2,
      fechaDeNacimiento,
      email,
      telefono
    }, { new: true });
    res.status(200).send('Estudiante actualizado exitosamente');
  } catch (err) {
    console.error('Error al actualizar al estudiante:', err);
    res.status(400).send('Error al actualizar al estudiante');
  }
});

appExpress.delete('/estudiantes/:id', async (req, res) => {
  try {
    await Estudiante.findByIdAndDelete(req.params.id);
    res.status(200).send('Estudiante eliminado exitosamente');
  } catch (err) {
    console.error('Error al eliminar al estudiante:', err);
    res.status(500).send('Error al eliminar al estudiante');
  }
});

// Generacion de reportes 
appExpress.get('/generarReporte', async (req, res) => {
  const { nombre, apellido, libro } = req.query;

  try {
    const estudiantes = await Estudiante.find({
      nombre: { $regex: new RegExp(nombre, 'i') },
      apellido: { $regex: new RegExp(apellido, 'i') }
    });

    if (estudiantes.length === 0) {
      return res.status(404).send('No se encontraron datos para el estudiante especificado');
    }

    // Buscar notas del estudiante
    const resultados = await Resultado.find({
      nombre: { $regex: new RegExp(nombre, 'i') },
      apellido: { $regex: new RegExp(apellido, 'i') }
    });

    // Buscar exámenes resueltos basados en los tokens de los resultados
    const tokens = resultados.map(resultado => resultado.token);

    const examenes = await Examen.find({ 
      token: { $in: tokens },
      libro: { $regex: new RegExp(libro, 'i') }  // Filtrar por libro
    });

    // Si no hay exámenes del libro especificado, enviar un mensaje
    if (examenes.length === 0) {
      return res.status(404).send('No se encontraron exámenes del libro especificado');
    }

    let reporteHTML = `
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reporte de ${nombre} ${apellido}</title>
          <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: #f8f9fa;
                  padding: 20px;
              }
              .container {
                  background-color: #ffffff;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                  margin-bottom: 20px;
                  overflow: hidden;
              }
              .table {
                  margin-top: 20px;
                  table-layout: auto;
                  width: 100%;
              }
              .table th, .table td {
                  text-align: center;
                  vertical-align: middle;
              }
              .header, .subheader {
                  background-color: #007bff;
                  color: #ffffff;
                  padding: 10px;
                  border-radius: 8px 8px 0 0;
                  text-align: center;
                  margin-bottom: 10px;
              }
              .header h1, .subheader h2 {
                  margin: 0;
              }
              .print-btn {
                  margin-top: 20px;
                  display: flex;
                  justify-content: center;
              }
              .print-btn button {
                  background-color: #007bff;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  font-size: 16px;
                  border-radius: 5px;
                  cursor: pointer;
              }
              .print-btn button:hover {
                  background-color: #0056b3;
              }
              @media print {
                  body {
                      background-color: #ffffff;
                  }
                  .container {
                      box-shadow: none;
                  }
                  .print-btn {
                      display: none;
                  }
              }
              .info-icon {
                  margin-right: 5px;
              }
              .table thead th {
                  font-size: 16px;
                  font-weight: bold;
              }
              .table tbody td {
                  font-size: 14px;
              }
          </style>
      </head>
      <body>
          <div class="container" style="max-width: 100%;">
              <div class="header">
                  <h1><i class="fas fa-file-alt info-icon"></i>Reporte de ${nombre} ${apellido}</h1>
              </div>
              <div class="subheader">
                  <h2><i class="fas fa-user info-icon"></i>Información Personal</h2>
              </div>
              <table class="table table-bordered table-hover">
                  <thead>
                      <tr>
                          <th><i class="fas fa-user"></i> Nombre</th>
                          <th><i class="fas fa-user"></i> Apellido</th>
                          <th><i class="fas fa-user"></i> Segundo Apellido</th>
                          <th><i class="fas fa-calendar-alt"></i> Fecha de Nacimiento</th>
                          <th><i class="fas fa-envelope"></i> Email</th>
                          <th><i class="fas fa-phone"></i> Teléfono</th>
                      </tr>
                  </thead>
                  <tbody>
    `;

    estudiantes.forEach(est => {
      reporteHTML += `
        <tr>
          <td>${est.nombre}</td>
          <td>${est.apellido}</td>
          <td>${est.apellido2}</td>
          <td>${est.fechaDeNacimiento.toISOString().split('T')[0]}</td>
          <td>${est.email}</td>
          <td>${est.telefono}</td>
        </tr>
      `;
    });

    reporteHTML += `
                  </tbody>
              </table>
              <div class="subheader">
                  <h2><i class="fas fa-clipboard-check info-icon"></i>Notas de Exámenes</h2>
              </div>
              <table class="table table-bordered table-hover">
                  <thead>
                      <tr>
                          <th><i class="fas fa-key"></i> Token</th>
                          <th><i class="fas fa-check"></i> Correctas</th>
                          <th><i class="fas fa-list"></i> Total</th>
                          <th><i class="fas fa-clipboard-check"></i> Nota</th>
                      </tr>
                  </thead>
                  <tbody>
    `;

    resultados.forEach(resultado => {
      reporteHTML += `
        <tr>
          <td>${resultado.token}</td>
          <td>${resultado.correctas}</td>
          <td>${resultado.total}</td>
          <td>${resultado.nota}</td>
        </tr>
      `;
    });

    reporteHTML += `
                  </tbody>
              </table>
              <div class="subheader">
                  <h2><i class="fas fa-book info-icon"></i>Detalles del Examen</h2>
              </div>
              <table class="table table-bordered table-hover">
                  <thead>
                      <tr>
                          <th><i class="fas fa-key"></i> Token</th>
                          <th><i class="fas fa-book"></i> Título</th>
                          <th><i class="fas fa-info-circle"></i> Descripción</th>
                          <th><i class="fas fa-book"></i> Tema</th>
                          <th><i class="fas fa-book"></i> Libro</th>
                          <th><i class="fas fa-signal"></i> Dificultad</th>
                          <th><i class="fas fa-clock"></i> Tiempo (minutos)</th>
                          <th><i class="fas fa-calendar-alt"></i> Fecha de Creación</th>
                      </tr>
                  </thead>
                  <tbody>
    `;

    examenes.forEach(examen => {
      const tiempoMinutos = (examen.tiempo / 60).toFixed(2); // Convertir tiempo a minutos y redondear a 2 decimales
      reporteHTML += `
        <tr>
          <td>${examen.token}</td>
          <td>${examen.titulo}</td>
          <td>${examen.descripcion}</td>
          <td>${examen.tema}</td>
          <td>${examen.libro}</td>
          <td>${examen.dificultad}</td>
          <td>${tiempoMinutos}</td>
          <td>${new Date(examen.fechaCreacion).toISOString().split('T')[0]}</td>
        </tr>
      `;
    });

    reporteHTML += `
                  </tbody>
              </table>
              <div class="subheader">
                  <h2><i class="fas fa-book info-icon"></i>Libros Utilizados en los Exámenes</h2>
              </div>
              <table class="table table-bordered table-hover">
                  <thead>
                      <tr>
                          <th><i class="fas fa-book"></i> Libro</th>
                          <th><i class="fas fa-list"></i> Cantidad de Exámenes</th>
                      </tr>
                  </thead>
                  <tbody>
    `;

    // Contar la cantidad de exámenes por libro
    const librosConteo = {};
    examenes.forEach(examen => {
      if (librosConteo[examen.libro]) {
        librosConteo[examen.libro]++;
      } else {
        librosConteo[examen.libro] = 1;
      }
    });

    Object.keys(librosConteo).forEach(libro => {
      reporteHTML += `
        <tr>
          <td>${libro}</td>
          <td>${librosConteo[libro]}</td>
        </tr>
      `;
    });

    reporteHTML += `
                  </tbody>
              </table>
              <div class="print-btn">
                  <button onclick="window.print()"><i class="fas fa-print"></i> Imprimir Reporte</button>
              </div>
          </div>
      </body>
      </html>
    `;

    res.send(reporteHTML);
  } catch (err) {
    console.error('Error al generar el reporte:', err);
    res.status(500).send('Error al generar el reporte');
  }
});



//appExpress.listen(PORT, () => {
  //console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
//});

if (process.env.NODE_ENV !== 'Admin') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '../node_modules', '.bin', 'electron')
  });
}

// Ruta de inicio de sesion del Estudiante 
appExpress.post('/loginEstudiante', async (req, res) => {
  const { email, telefono } = req.body;

  try {
    const estudiante = await Estudiante.findOne({ email, telefono });

    if (!estudiante) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    res.json({ message: 'Autenticación exitosa' });

  } catch (dbError) {
    console.error('Error al acceder a la base de datos:', dbError);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ventanas para las interfaces 

const User = Usuario;

let mainWindow;
let loginWindow;
let UsertWindow;
let archivosWindow;
let configWindow;
let passwordWindow;
let PreguntasWindow;
let estudianteWindow;
let notasWindow;

//Menu para las interactuar con las interfaces
const templateMenu = [
  {
    label: 'File',
    submenu: [
      {
        label: 'usuarios',
        accelerator: 'Ctrl+N',
        click() {
          createUsertWindow();
        }
      },
      {
        label: 'Examenes',
        accelerator: 'Ctrl+D',
        click() {
          createarchivotWindow();
        }
      },
      {
        label: 'Configuracion',
        accelerator: 'Ctrl+A',
        click() {
          createconfigtWindow();
        }
      },
      {
        label: 'Preguntas',
        accelerator: 'Ctrl+T',
        click() {
          createPreguntatWindow();
        }
      },
      {
        label: 'Notas',
        accelerator: 'Ctrl+T',
        click() {
          createNotasWindow();
        }
      },
      {
        label: 'Salir',
        accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
        click() {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Devtools',
    submenu: [
      {
        label: 'Show/Hide Dev Tools',
        click(item, focusWindow) {
          focusWindow.toggleDevTools();
        }
      },
      {
        role: 'reload'
      }
    ]
  }
];

//Iniciar desde la ventana Login
app.on('ready', () => {
  //const mainMenu = Menu.buildFromTemplate(templateMenu);
  //Menu.setApplicationMenu(mainMenu);
  createLoginWindow();
});

// Ventana de inicio de sesion 
function createLoginWindow() {
  if (mainWindow) mainWindow.close();
  if (UsertWindow) UsertWindow.close();
  
  loginWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      autoHideMenuBar: true
    }
  });
  
  loginWindow.setMenu(null);
  loginWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/Login.html'),
    protocol: 'file:',
    slashes: true
  }));

  loginWindow.on('closed', () => {
    loginWindow = null;
  });

  ipcMain.once('login-success', () => {
    if (loginWindow) {
      loginWindow.close();
    }
    createMainWindow();
  });
}

// Ventana Menu del administrador
function createMainWindow() {
  if (loginWindow) loginWindow.close();
  if (UsertWindow) UsertWindow.close();

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  mainWindow.on('closed', () => {
    app.quit();
  });
}

// Ventana para registro de estudiantes
function createUsertWindow() {
  if (mainWindow) mainWindow.close();
  if (loginWindow) loginWindow.close();

  UsertWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Add a user',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  UsertWindow.setMenu(null);
  UsertWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/usuarios.html'),
    protocol: 'file:',
    slashes: true
  }));
  UsertWindow.on('closed', () => {
    UsertWindow = null;
    createMainWindow();
  });
}

// Ventana Para las Notas del estudiante
function createNotasWindow() {
  if (mainWindow) mainWindow.close();
  if (loginWindow) loginWindow.close();

  notasWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Add a notas',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  notasWindow.setMenu(null);
  notasWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/Notas.html'),
    protocol: 'file:',
    slashes: true
  }));
  notasWindow.on('closed', () => {
    notasWindow = null;
    createMainWindow();
  });
}

function createarchivotWindow() {
  if (mainWindow) mainWindow.close();
  if (loginWindow) loginWindow.close();

  archivosWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Add a Examen',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  archivosWindow.setMenu(null);
  archivosWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/Examenes.html'),
    protocol: 'file:',
    slashes: true
  }));
  archivosWindow.on('closed', () => {
    archivosWindow = null;
    createMainWindow();
  });
}

function createconfigtWindow() {
  if (mainWindow) mainWindow.close();
  if (loginWindow) loginWindow.close();

  configWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Add a config',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  configWindow.setMenu(null);
  configWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/configuracion.html'),
    protocol: 'file:',
    slashes: true
  }));
  configWindow.on('closed', () => {
    configWindow = null;
    createMainWindow();
  });
}

function createPreguntatWindow() {
  if (mainWindow) mainWindow.close();
  if (loginWindow) loginWindow.close();

  PreguntasWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Add a user',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });
  PreguntasWindow.setMenu(null);
  PreguntasWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/Preguntas.html'),
    protocol: 'file:',
    slashes: true
  }));
  PreguntasWindow.on('closed', () => {
    PreguntasWindow = null;
    createMainWindow();
  });
}


// Función para crear la ventana de estudiantes
function createStudentWindow() {
  if (loginWindow) loginWindow.close();

  estudianteWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Panel de Estudiantes',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    },
    
  });
  estudianteWindow.setMenu(null);
  estudianteWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../src/view/Estudiante.html'), 
    protocol: 'file:',
    slashes: true
  }));


  estudianteWindow.on('closed', () => {
    estudianteWindow = null;
    createLoginWindow();
  });
}


// Manejo del login
ipcMain.handle('login', async (event, identifier, credential) => {
  try {
    // Intentar autenticación como administrador
    const admin = await Usuario.findOne({ username: identifier });
    if (admin && await bcrypt.compare(credential, admin.password)) {
      console.log('Administrador autenticado:', admin);
      event.sender.send('login-success');
      return 'admin';
    }

    // Intentar autenticación como estudiante
    const estudiante = await Estudiante.findOne({ email: identifier, telefono: credential });
    if (estudiante) {
      console.log('Estudiante autenticado:', estudiante);
      event.sender.send('login-success-estudiante');
      return 'estudiante';
    }

    // Si no se encuentra ninguna coincidencia, devolver falso
    console.log('Credenciales no válidas');
    return false;
  } catch (error) {
    console.error('Error durante la autenticación:', error);
    return false;
  }
});


// restablecimiento de contraseña
ipcMain.handle('request-password-reset', async (event, email) => {
  console.log('Solicitud de restablecimiento de contraseña para:', email);
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Correo electrónico no encontrado');
      return { success: false, message: 'Correo electrónico no encontrado' };
    }

    const pin = Math.floor(10000 + Math.random() * 90000).toString();
    console.log('Token de restablecimiento generado:', pin);

    const hashedToken = await bcrypt.hash(pin, 10);
    user.password = hashedToken;
    user.resetTokenExpiration = Date.now() + 3600000; 
    await user.save();
    console.log('Usuario actualizado con nueva contraseña');

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'antoniotaboada777@gmail.com',
        pass: 'okcwsmartkunpxnu',
      },
    });

    const mailOptions = {
      from: 'antoniotaboada777@gmail.com',
      to: email,
      subject: 'Cambio de contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #4CAF50; text-align: center;">Cambio de contraseña</h2>
          <p>Hola,</p>
          <p>Hemos recibido una solicitud para restablecer su contraseña. Su nueva contraseña es:</p>
          <p style="font-size: 18px; font-weight: bold; text-align: center; background-color: #f9f9f9; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">${pin}</p>
          <p>Gracias,</p>
          <p>Escuela de Idiomas del Ejercito</p>
          <hr>
          <p style="font-size: 12px; color: #999; text-align: center;">&copy; 2024 Su Empresa. Todos los derechos reservados.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado:', info.response);
    return { success: true, message: ' enviado al correo exitosamente!' };

  } catch (error) {
    console.error('Error al recibir la nueva contraseña:', error);
    return { success: false, message: 'Error al recibir la nueva contraseña' };
  }
});


//funcion para abrir la interfaz del menu del administrador
ipcMain.on('login-success', () => {
  console.log('Login successful event received');
  createMainWindow();
});


//funcion para abrir la interfaz del estudiante
ipcMain.on('login-success-estudiante', () => {
  createStudentWindow();
});


//funcion para retroceder al menu anterior
ipcMain.on('back-to-menu', (event) => {
  if (UsertWindow) {
    UsertWindow.close();
  }
});


//funcion para salir de las ventanas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLoginWindow();
  }
});

//funcion para retroceder al login 
ipcMain.on('navigate-to-login', () => {
  if (estudianteWindow) {
    estudianteWindow.close();
    estudianteWindow = null;
  }
  createLoginWindow();
});