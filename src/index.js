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
const Seguimiento = require('./Entidades/Seguimiento');
const Registro = require('./Entidades/Registro');
const Libros = require('./Entidades/Libros');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io'); 
const net = require('net');
const cors = require('cors'); 

const appExpress = express();
const server = http.createServer(appExpress); 
const io = socketIO(server);

appExpress.use(cors());
const PORTS = [3000, 3001];

//Ruta de Ngrok para la APP
const NGROK_URL = 'https://a42f-189-28-66-50.ngrok-free.app';
const LOGIN_URL = `${NGROK_URL}/loginEstudianteToken`;
const LOGOUT_URL = `${NGROK_URL}/logoutEstudiante`;
const EXAMENES_POR_NIVEL_URL = `${NGROK_URL}/examenesPorNivel`;

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // El puerto está en uso
      } else {
        reject(err);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true); // El puerto no está en uso
    });

    server.listen(port);
  });
}

async function startServer() {
  for (let port of PORTS) {
    const isAvailable = await checkPort(port);
    if (isAvailable) {
      server.listen(port, () => {
        console.log(`Servidor Express con socket.io corriendo en http://localhost:${port}`);
      });
      break;
    } else {
      console.log(`Puerto ${port} está en uso. Intentando con otro puerto...`);
    }
  }
}

// Iniciar el servidor en un puerto disponible
startServer();


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
appExpress.use('/audios', express.static(path.join(__dirname, '../src/view/audios')));

// Configuración de socket.io
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Ruta para obtener los temas por tomo (libro)
appExpress.get('/api/temas', async (req, res) => {
  try {
    const { tomo } = req.query; // Obtener el parámetro de consulta tomo
    if (!tomo) {
      return res.status(400).send('Falta el parámetro tomo');
    }

    // Buscar temas por el tomo seleccionado
    const temas = await Libros.find({ tomo }).select('tema -_id'); // Selecciona solo los temas del tomo
    res.status(200).json(temas); // Devuelve los temas asociados a ese tomo
  } catch (error) {
    console.error('Error al obtener los temas:', error);
    res.status(500).send('Error al obtener los temas');
  }
});

// Ruta para guardar un nuevo Tema en un libro
appExpress.post('/api/libros', async (req, res) => {
  const { tomo, nivel, tema } = req.body;

  try {
    const nuevoLibro = new Libros({ tomo, nivel, tema });
    await nuevoLibro.save();
    res.status(201).send('Tema guardado exitosamente');
  } catch (error) {
    console.error('Error al guardar el tema:', error);
    res.status(500).send('Error al guardar el tema');
  }
});

// Ruta para obtener todos los libros registrados
appExpress.get('/api/libros', async (req, res) => {
  try {
    const libros = await Libros.find();
    res.status(200).json(libros);
  } catch (error) {
    console.error('Error al obtener los temas:', error);
    res.status(500).send('Error al obtener los temas');
  }
});

// Ruta para eliminar un libro por ID
appExpress.delete('/api/libros/:id', async (req, res) => {
  try {
    await Libros.findByIdAndDelete(req.params.id);
    res.status(200).send('Tema eliminado exitosamente');
  } catch (error) {
    console.error('Error al eliminar el tema:', error);
    res.status(500).send('Error al eliminar el tema');
  }
});

// Ruta para actualizar un libro por ID
appExpress.put('/api/libros/:id', async (req, res) => {
  const { tomo, nivel, tema } = req.body;
  
  try {
    const libro = await Libros.findByIdAndUpdate(req.params.id, { tomo, nivel, tema }, { new: true });
    res.status(200).send('Tema actualizado exitosamente');
  } catch (error) {
    console.error('Error al actualizar el tema:', error);
    res.status(500).send('Error al actualizar el tema');
  }
});

// Ruta para crear un nuevo registro que relacione un examen con el resultado de un estudiante
appExpress.post('/crearRegistro', async (req, res) => {
  const { examenId, resultadoId } = req.body;

  try {
    const examen = await Examen.findById(examenId);
    const resultado = await Resultado.findById(resultadoId);

    if (!examen || !resultado) {
      return res.status(404).json({ message: 'Examen o Resultado no encontrado' });
    }

    const nuevoRegistro = new Registro({ examen: examenId, resultado: resultadoId });
    await nuevoRegistro.save();

    res.status(201).json({ message: 'Registro creado con éxito', registro: nuevoRegistro });
  } catch (error) {
    console.error('Error al crear el registro:', error);
    res.status(500).json({ message: 'Error al crear el registro', error });
  }
});

// Ruta para obtener los registros (para los reportes)
appExpress.get('/obtenerRegistros', async (req, res) => {
  try {
    const { libro } = req.query;  // Obtener el filtro de libro de la consulta
    let query = {};

    if (libro) {
      query['examen.libro'] = libro;  // Filtro por libro
    }

    const registros = await Registro.find(query).populate('examen').populate('resultado');
    res.status(200).json(registros);
  } catch (error) {
    console.error('Error al obtener los registros:', error);
    res.status(500).json({ message: 'Error al obtener los registros', error });
  }
});

//Ruta para obtener los datos del estudiante por el token
appExpress.get('/obtenerExamenPorToken', async (req, res) => {
  const { token } = req.query;

  try {
    const examen = await Examen.findOne({ token });

    if (!examen) {
      return res.status(404).json({ message: 'Token no encontrado' });
    }

    // Devolver solo los datos del examen
    res.json({
      exito: true,
      preguntas: examen.preguntas,
      tiempoRestante: examen.tiempo,  // En segundos
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el examen', error });
  }
});
// Ruta de calificación de examen
appExpress.post('/calificarExamen', async (req, res) => {
  const { token, nombre, apellido, apellido2, respuestas, horaInicio, horaFin } = req.body;

  try {
    console.log('Datos recibidos:', { token, nombre, apellido, apellido2, respuestas, horaInicio, horaFin });

    let correctas = 0;

    // Asegurarse de que `respuestas` sea un array válido
    if (!Array.isArray(respuestas)) {
      return res.status(400).send('Las respuestas deben ser un array válido.');
    }

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

    // Convertir horaInicio y horaFin en objetos Date
    const inicio = new Date(horaInicio);
    const fin = new Date(horaFin);

    // Calcular la diferencia en minutos
    const tiempoTranscurridoMs = fin - inicio;
    const tiempoTranscurridoMin = Math.floor(tiempoTranscurridoMs / 60000);

    // Buscar el examen utilizando el token
    const examen = await Examen.findOne({ token });
    if (!examen) {
      return res.status(404).json({ message: 'Examen no encontrado' });
    }

    // Crear un nuevo resultado con todos los campos necesarios
    const nuevoResultado = new Resultado({
      token,
      nombre,
      apellido,
      apellido2,
      correctas,
      total,
      nota,
      horaInicio: inicio,
      horaFin: fin,
      tiempoTranscurrido: tiempoTranscurridoMin,
      titulo: examen.titulo, // Agregando el título del examen
      id_examen: examen._id // Agregando el ID del examen
    });

    await nuevoResultado.save();

    // Crear un registro que relacione el examen con el resultado
    const nuevoRegistro = new Registro({
      examen: examen._id,
      resultado: nuevoResultado._id
    });

    await nuevoRegistro.save();

    console.log('Examen calificado y registro creado:', { correctas, total, nota, detalles, tiempoTranscurridoMin, registro: nuevoRegistro });

    res.send({ correctas, total, nota, detalles, tiempoTranscurrido: tiempoTranscurridoMin });
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

// Ruta para obtener la cantidad de libros utilizados Grafico
appExpress.get('/obtenerLibrosUtilizados', async (req, res) => {
  try {
      const libros = await Examen.aggregate([
          { $group: { _id: "$libro", count: { $sum: 1 } } },
          { $sort: { _id: 1 } } // Ordenar por el identificador del libro para claridad
      ]);

      // Mapear los resultados para incluir los nombres de los libros si es necesario
      const librosConNombres = libros.map(libro => {
          return {
              libro: `Libro ${libro._id}`, // Esto asume que "libro" es un número que representa el libro
              cantidad: libro.count
          };
      });

      res.json(librosConNombres);
  } catch (error) {
      console.error('Error al obtener los libros utilizados:', error);
      res.status(500).send('Error al obtener los libros utilizados');
  }
});

appExpress.get('/obtenerExamenesPorNivel', async (req, res) => {
  try {
      const niveles = await Examen.aggregate([
          { $group: { _id: "$dificultad", count: { $sum: 1 } } }
      ]);

      console.log('Niveles agrupados:', niveles); 

      res.json(niveles);
  } catch (error) {
      console.error('Error al obtener los exámenes por nivel:', error);
      res.status(500).send('Error al obtener los exámenes por nivel');
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

// Función para detectar el nivel según el libro
function detectarNivelPorLibro(libro) {
  const libroNumero = parseInt(libro, 10); // Convertir libro a número, por si viene como cadena

  if (libroNumero >= 1 && libroNumero <= 9) {
    return 'Básico';  // Nivel básico
  } else if (libroNumero >= 10 && libroNumero <= 19) {
    return 'Intermedio';  // Nivel intermedio
  } else if (libroNumero >= 20 && libroNumero <= 30) {
    return 'Avanzado';  // Nivel avanzado
  } else {
    return 'Básico';  // Por defecto, nivel básico
  }
}

// Rutas para examenes
appExpress.post('/generarExamen', async (req, res) => {
  const { titulo, descripcion, tema, libro, tiposPreguntas, numeroOpciones, contenidoHTML, fechaCreacion, horaInicio, horaFin } = req.body;

  console.log('Datos recibidos:', req.body);

  // Generar las preguntas
  const { preguntas, token, creationTime, expiresAt, palabrasClave } = generateQuestions(tema, tiposPreguntas, numeroOpciones, libro);

  if (!preguntas || preguntas.length === 0) {
    console.error('Error al generar preguntas: No se generaron preguntas');
    return res.status(400).send('Error al generar preguntas: No se generaron preguntas');
  }

  // Ajuste automático del tiempo basado en los tipos de preguntas
  let tiempo = 10; // Tiempo por defecto en minutos
  if (tiposPreguntas.includes('listening')) {
    tiempo = 15; // Si se selecciona Listening, se asigna 15 minutos
  }

  const preguntasConAudios = preguntas.map((pregunta, index) => {
    let nivel;
    switch (detectarNivelPorLibro(libro)) {
      case 'facil':
        nivel = 'audio_basico';
        break;
      case 'medio':
        nivel = 'audio_intermedio';
        break;
      case 'dificil':
        nivel = 'audio_avanzado';
        break;
      default:
        nivel = 'audio_basico';
    }

    return {
      ...pregunta,
      audioUrl: `/audios/${nivel}${index + 1}.mp3`
    };
  });

  console.log('Preguntas con audios:', preguntasConAudios);

  // Asegúrate de incluir tanto horaInicio como horaFin al crear el nuevo examen
  const nuevoExamen = new Examen({
    titulo,
    descripcion,
    tema,
    libro,
    tipo: tiposPreguntas.join(','),
    incluyeImagenes: false,
    preguntas: preguntasConAudios,
    dificultad: detectarNivelPorLibro(libro), // Determinar la dificultad según el libro
    token,
    contenidoHTML,
    fechaCreacion: fechaCreacion ? new Date(fechaCreacion) : new Date(),
    tiempo: tiempo * 60, // Convertir el tiempo de minutos a segundos
    expiresAt,
    palabrasClave,
    horaInicio: new Date(horaInicio),  // Incluir el campo horaInicio
    horaFin: new Date(horaFin)  // Incluir el campo horaFin
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
  let { token, nombre, apellido, apellido2 } = req.body;

  // Normalizar el token para evitar diferencias debido a caracteres invisibles
  token = token.trim().normalize();

  try {
    // Verificar si el estudiante ya ha resuelto algún examen
    const resultadoPorEstudiante = await Resultado.findOne({ nombre, apellido, apellido2 });
    if (resultadoPorEstudiante) {
      return res.status(400).json({ message: 'Usted ya resolvió un examen.' });
    }

    // Verificación del token en la tabla de exámenes
    const examen = await Examen.findOne({ token });
    if (!examen) {
      return res.status(400).json({ message: 'Token no válido o expirado' });
    }

    const now = new Date();

    // Verificar si el examen aún no ha comenzado
    if (now < new Date(examen.horaInicio)) {
      return res.status(400).json({ message: `El examen estará disponible a partir de las ${examen.horaInicio.toLocaleString()}` });
    }

    // Verificar si el examen ya ha terminado
    if (now > new Date(examen.horaFin)) {
      return res.status(400).json({ message: `El examen ya no está disponible, el tiempo límite fue ${examen.horaFin.toLocaleString()}` });
    }

    // Verificar expiración del token
    if (now > new Date(examen.expiresAt)) {
      return res.status(400).json({ message: 'Token no válido o expirado' });
    }

    // Si todo está correcto, permitir acceso al examen
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

      // Mapear los exámenes para cambiar los valores de dificultad
      const examenesConDificultadModificada = examenes.map(examen => {
          let dificultadMostrar = '';
          switch (examen.dificultad) {
              case 'facil':
                  dificultadMostrar = 'Básico';
                  break;
              case 'medio':
                  dificultadMostrar = 'Intermedio';
                  break;
              case 'dificil':
                  dificultadMostrar = 'Avanzado';
                  break;
              default:
                  dificultadMostrar = examen.dificultad;
          }

          // Retornar el examen con la dificultad traducida
          return {
              ...examen._doc,  
              dificultad: dificultadMostrar  
          };
      });

      res.json(examenesConDificultadModificada);
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

// Ruta para obtener una pregunta específica por su ID
appExpress.get('/preguntas/:id', async (req, res) => {
  try {
    const pregunta = await Pregunta.findById(req.params.id);
    res.json(pregunta);
  } catch (err) {
    console.error('Error al obtener la pregunta:', err);
    res.status(500).send('Error al obtener la pregunta');
  }
});

// Ruta para crear una nueva pregunta
appExpress.post('/preguntas', upload.single('audio'), async (req, res) => {
  const { tipo, pregunta, opciones, respuestaCorrecta, dificultad, libro } = req.body;
  const audio = req.file ? req.file.path : undefined;

  const nuevaPregunta = new Pregunta({
    tipo,
    pregunta,
    opciones: tipo !== 'listening' ? opciones.split(',') : undefined,
    respuestaCorrecta,
    dificultad,
    libro,
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

// Ruta para actualizar una pregunta existente
appExpress.put('/preguntas/:id', upload.single('audio'), async (req, res) => {
  const { tipo, pregunta, opciones, respuestaCorrecta, dificultad, libro } = req.body;
  const audio = req.file ? req.file.path : undefined;

  const actualizaciones = {
    tipo,
    pregunta,
    opciones: tipo !== 'listening' ? opciones.split(',') : undefined,
    respuestaCorrecta,
    dificultad,
    libro
  };

  if (audio) {
    actualizaciones.audio = audio;
  }

  try {
    await Pregunta.findByIdAndUpdate(req.params.id, actualizaciones);
    res.status(200).send('Pregunta actualizada exitosamente');
  } catch (err) {
    console.error('Error al actualizar la pregunta:', err);
    res.status(400).send('Error al actualizar la pregunta');
  }
});

// Ruta para eliminar una pregunta
appExpress.delete('/preguntas/:id', async (req, res) => {
  try {
    await Pregunta.findByIdAndDelete(req.params.id);
    res.status(200).send('Pregunta eliminada exitosamente');
  } catch (err) {
    console.error('Error al eliminar la pregunta:', err);
    res.status(500).send('Error al eliminar la pregunta');
  }
});

// Ruta para filtrar preguntas
appExpress.get('/filtrarPreguntas', async (req, res) => {
  const { libro, tipo } = req.query;

  try {
    let query = {};
    if (libro) query.libro = libro;
    if (tipo) query.tipo = tipo;

    const preguntasFiltradas = await Pregunta.find(query);
    res.json(preguntasFiltradas);
  } catch (err) {
    console.error('Error al filtrar preguntas:', err);
    res.status(500).send('Error al filtrar preguntas');
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

//ruta para obtener al estudiante
appExpress.get('/estudiantes/:id', async (req, res) => {
  try {
    const estudiante = await Estudiante.findById(req.params.id);
    res.json(estudiante);
  } catch (err) {
    console.error('Error al obtener los datos del estudiante:', err);
    res.status(500).send('Error al obtener los datos del estudiante');
  }
});

//ruta para registro de estudiantes
appExpress.post('/registro', async (req, res) => {
  const { nombre, apellido, apellido2, fechaDeNacimiento, email, telefono, nivel, libro } = req.body;

  try {
    const estudianteExistente = await Estudiante.findOne({ $or: [{ email }, { telefono }] });

    if (estudianteExistente) {
      return res.status(400).send('El correo electrónico o el teléfono ya están registrados.');
    }

    const nuevoEstudiante = new Estudiante({
      nombre,
      apellido,
      apellido2,
      fechaDeNacimiento,
      email,
      telefono,
      nivel,
      libro  
    });

    await nuevoEstudiante.save();
    res.status(201).send('Estudiante registrado exitosamente');
  } catch (err) {
    console.error('Error al registrar al estudiante:', err);
    res.status(500).send('Error al registrar al estudiante');
  }
});


// Ruta para obtener exámenes clasificados por nivel
appExpress.get('/examenesPorNivel', async (req, res) => {
  const nivel = req.query.nivel;
  try {
    let examenes;

    if (nivel === 'basico') {
      examenes = await Examen.find({ dificultad: 'facil' }).select('token');
    } else if (nivel === 'intermedio') {
      examenes = await Examen.find({ dificultad: 'medio' }).select('token');
    } else if (nivel === 'avanzado') {
      examenes = await Examen.find({ dificultad: 'dificil' }).select('token');
    } else {
      return res.status(400).send('Nivel no válido');
    }

    const tokens = examenes.map(examen => examen.token);
    res.json({ tokens });
  } catch (error) {
    console.error('Error al obtener los exámenes por nivel:', error);
    res.status(500).send('Error al obtener los exámenes por nivel');
  }
});

//ruta para acualizar estudiante
appExpress.put('/estudiantes/:id', async (req, res) => {
  const { nombre, apellido, apellido2, fechaDeNacimiento, email, telefono, nivel, libro } = req.body;

  try {
    const estudianteExistente = await Estudiante.findOne({ $or: [{ email }, { telefono }], _id: { $ne: req.params.id } });

    if (estudianteExistente) {
      return res.status(400).send('El correo electrónico o el teléfono ya están registrados.');
    }

    await Estudiante.findByIdAndUpdate(req.params.id, {
      nombre,
      apellido,
      apellido2,
      fechaDeNacimiento,
      email,
      telefono,
      nivel,
      libro  // Asegúrate de actualizar aquí el campo libro
    }, { new: true });

    res.status(200).send('Estudiante actualizado exitosamente');
  } catch (err) {
    console.error('Error al actualizar al estudiante:', err);
    res.status(500).send('Error al actualizar al estudiante');
  }
});

//ruta para eliminar al estudiante
appExpress.delete('/estudiantes/:id', async (req, res) => {
  try {
    await Estudiante.findByIdAndDelete(req.params.id);
    res.status(200).send('Estudiante eliminado exitosamente');
  } catch (err) {
    console.error('Error al eliminar al estudiante:', err);
    res.status(500).send('Error al eliminar al estudiante');
  }
});

// ruta para obtener las evaluaciones de un estudiante específico
appExpress.get('/evaluacionesEstudiante', async (req, res) => {
  const { nombre, apellido, apellido2 } = req.query;

  try {
      const evaluaciones = await Resultado.find({
          nombre: new RegExp(nombre, 'i'),
          apellido: new RegExp(apellido, 'i'),
          apellido2: new RegExp(apellido2, 'i')
      });

      if (evaluaciones.length === 0) {
          return res.json({ message: 'No se encontraron evaluaciones para este estudiante.' });
      }

      res.json(evaluaciones);
  } catch (error) {
      console.error('Error al buscar evaluaciones:', error);
      res.status(500).json({ message: 'Error al buscar evaluaciones' });
  }
});

//Ruta para generar Reportes
appExpress.get('/generarReporte', async (req, res) => {
  console.log(req.query);
  const { estado, nombre, apellido, apellido2, libro, tema, incluirInscritos } = req.query;

  const horaInicio = new Date();

  try {
    let query = {};
    let resultadosGenerales = [];
    let registrosLibroTema = [];
    let estudiantes = [];

    // Dependiendo de los parámetros del filtro, generamos un tipo de reporte
    let isFilteredByEstudiantes = incluirInscritos === 'true';
    let isFilteredByLibro = libro || tema;
    let isFilteredByEstado = estado || nombre || apellido || apellido2;

    // Filtrar por estudiantes inscritos
    if (isFilteredByEstudiantes) {
      estudiantes = await Estudiante.find(); // Obtener todos los estudiantes si se solicitó
    }

    // Filtrar por libro o tema
    if (isFilteredByLibro) {
      registrosLibroTema = await Registro.find().populate('examen').populate('resultado');

      if (libro) {
        registrosLibroTema = registrosLibroTema.filter(registro => registro.examen.libro === libro);
      }
      if (tema) {
        registrosLibroTema = registrosLibroTema.filter(registro => registro.examen.tema.toLowerCase().includes(tema.toLowerCase()));
      }
    }

    // Filtrar por nombre, apellido, estado
    if (isFilteredByEstado) {
      resultadosGenerales = await Resultado.find();  // Esto traerá todos los resultados sin filtrar

      // Aplicar filtros por nombre, apellido o estado
      if (nombre) {
        resultadosGenerales = resultadosGenerales.filter(resultado => resultado.nombre.toLowerCase().includes(nombre.toLowerCase()));
      }
      if (apellido) {
        resultadosGenerales = resultadosGenerales.filter(resultado => resultado.apellido.toLowerCase().includes(apellido.toLowerCase()));
      }
      if (apellido2) {
        resultadosGenerales = resultadosGenerales.filter(resultado => resultado.apellido2 && resultado.apellido2.toLowerCase().includes(apellido2.toLowerCase()));
      }
      if (estado === 'aprobado') {
        resultadosGenerales = resultadosGenerales.filter(resultado => resultado.nota >= 6);  // Filtrar aprobados
      } else if (estado === 'reprobado') {
        resultadosGenerales = resultadosGenerales.filter(resultado => resultado.nota < 6);  // Filtrar reprobados
      }
    }

    // Validar que al menos haya resultados
    if (resultadosGenerales.length === 0 && registrosLibroTema.length === 0 && estudiantes.length === 0) {
      const doc = new PDFDocument({ margin: 30 });
      doc.fontSize(14).text('No se encontraron resultados ni estudiantes inscritos', { align: 'center' });
      doc.end();
      return doc.pipe(res);
    }

    // Crear un nuevo PDF y reiniciar el contenido
    const doc = new PDFDocument({ margin: 0 });
    let filename = 'Reporte.pdf';
    let title = 'Reporte de Evaluaciones';

    // Definir el título y nombre del archivo basado en los parámetros
if (incluirInscritos === 'true') {
  filename = 'Reporte_Inscritos.pdf';
  title = 'Reporte de Estudiantes Inscritos';
} else if (nombre && apellido) {
  // Si se filtra por nombre y apellido, cambiar el título a "Reporte del estudiante [Nombre Completo]"
  let nombreCompleto = `${nombre} ${apellido}`;
  if (apellido2) {
      nombreCompleto += ` ${apellido2}`;
  }
  filename = `Reporte_${nombre}.pdf`;
  title = `Reporte del estudiante ${nombreCompleto}`;  // Cambia el título a "Reporte del estudiante [Nombre Completo]"
} else if (estado) {
  filename = `Reporte_${estado}.pdf`;
  title = `Reporte de Estudiantes ${estado.charAt(0).toUpperCase() + estado.slice(1)}`;
} else if (libro) {
  filename = `Reporte_Libro_${libro}.pdf`;
  title = `Reporte de Evaluaciones por Libro`;
} else if (tema) {
  filename = `Reporte_Tema_${tema}.pdf`;
  title = `Reporte de Evaluaciones por Tema`;
}

    filename = encodeURIComponent(filename);
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    // Añadir un borde oscuro alrededor del contenido
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#004080').lineWidth(10).stroke();
    doc.fillColor('#004080').polygon([20, 20], [60, 20], [20, 60]).fill();
    doc.fillColor('#004080').polygon([doc.page.width - 20, doc.page.height - 20], [doc.page.width - 60, doc.page.height - 20], [doc.page.width - 20, doc.page.height - 60]).fill();

    // Posicionar el escudo
    const escudoPath = path.join(__dirname, 'view', 'img', 'EIE_ESCUDO.png');
    doc.image(escudoPath, 70, 70, { width: 70 });
    doc.font('Helvetica-Bold').fontSize(18).fillColor('black').text('Escuela de Idiomas del Ejército', 160, 90);
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('black').text(title, 70, 160, { align: 'left' });
    doc.moveDown(1);

    // Generar la tabla correcta según el filtro
    if (isFilteredByEstudiantes) {
      doc.fontSize(14).text('Estudiantes Inscritos:', { align: 'center' });
      generateEstudiantesTable(doc, estudiantes);  // Asegúrate de que esta función esté definida
    } else if (isFilteredByLibro) {
      generateLibroTemaTable(doc, registrosLibroTema);  // Asegúrate de que esta función esté definida
    } else if (isFilteredByEstado) {
      generateStyledTable(doc, resultadosGenerales);  // Asegúrate de que esta función esté definida
    }

    // Agregar pie de página con fecha y hora
    const horaFin = new Date();
    const fechaActual = new Date().toLocaleDateString();
    const horaInicioTexto = horaInicio.toLocaleTimeString();
    const horaFinTexto = horaFin.toLocaleTimeString();
    doc.fontSize(12).fillColor('black')
      .text(`Fecha: ${fechaActual}`, doc.page.width - 150, doc.page.height - 80);
    doc.fontSize(10).fillColor('black')
      .text(`Reporte generado por Admin`, 30, doc.page.height - 50)
      .text(`Generado el: ${fechaActual} a las ${horaFinTexto}`, 30, doc.page.height - 35);

    // Finalizar el PDF
    doc.end();
    doc.pipe(res);
  } catch (error) {
    console.error('Error al generar el reporte:', error);
    res.status(500).send('Error al generar el reporte');
  }
});

function generateEstudiantesTable(doc, estudiantes) {
  const tableTop = 250;  // Cambiar de 250 a 100 para comenzar más arriba si es necesario
  const itemHeight = 20;
  const cellWidths = [60, 60, 60, 150, 70, 70, 50];
  const totalTableWidth = cellWidths.reduce((a, b) => a + b, 0);
  const leftMargin = (doc.page.width - totalTableWidth) / 2;

  // Dibujar el encabezado de la tabla
  doc.fontSize(12).fillColor('white').rect(leftMargin, tableTop, totalTableWidth, itemHeight).fill('#007bff');
  const headers = ["Nombre", "Paterno", "Materno", "Email", "Teléfono", "Nivel", "Libro"];  // Encabezados incluyendo "Libro"
  headers.forEach((header, i) => {
      doc.fillColor('white').font('Helvetica-Bold').text(header, leftMargin + cellWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5, tableTop + 5, { width: cellWidths[i], align: 'center' });
  });

  // Dibujar las filas de los estudiantes
  estudiantes.forEach((estudiante, i) => {
      const y = tableTop + (i + 1) * itemHeight;
      if (i % 2 === 0) {
          doc.fillColor('#f9f9f9').rect(leftMargin, y, totalTableWidth, itemHeight).fill();  // Alternar color en las filas
      }

      let xPosition = leftMargin;
      doc.fillColor('#333333').font('Helvetica');

      // Convertir todo a cadena usando toString() si es necesario
      doc.text(estudiante.nombre, xPosition + 5, y + 5, { width: cellWidths[0], align: 'center' });
      xPosition += cellWidths[0];
      doc.text(estudiante.apellido, xPosition + 5, y + 5, { width: cellWidths[1], align: 'center' });
      xPosition += cellWidths[1];
      doc.text(estudiante.apellido2 || '', xPosition + 5, y + 5, { width: cellWidths[2], align: 'center' });
      xPosition += cellWidths[2];
      doc.text(estudiante.email.toString(), xPosition + 5, y + 5, { width: cellWidths[3], align: 'center' });  // Asegurar que el email es una cadena
      xPosition += cellWidths[3];
      doc.text(estudiante.telefono.toString(), xPosition + 5, y + 5, { width: cellWidths[4], align: 'center' });
      xPosition += cellWidths[4];
      doc.text(estudiante.nivel, xPosition + 5, y + 5, { width: cellWidths[5], align: 'center' });
      xPosition += cellWidths[5];
      doc.text(estudiante.libro || 'N/A', xPosition + 5, y + 5, { width: cellWidths[6], align: 'center' });  // Mostrar el libro o "N/A" si no existe
  });
}

// Función para generar la tabla de resultados generales
function generateStyledTable(doc, resultados) {
  const tableTop = 250;
  const itemHeight = 20;
  const cellWidths = [60, 60, 70, 60, 65, 60, 50, 70];  // Anchos de cada celda, incluyendo Tiempo
  const totalTableWidth = cellWidths.reduce((a, b) => a + b, 0);
  const leftMargin = (doc.page.width - totalTableWidth) / 2;

  doc.fontSize(12).fillColor('white').rect(leftMargin, tableTop, totalTableWidth, itemHeight).fill('#007bff');
  const headers = ["Nombre", "Paterno", "Materno", "Correctas", "Incorrectas", "Total", "Nota", "Tiempo"];
  headers.forEach((header, i) => {
      doc.fillColor('white').font('Helvetica-Bold').text(header, leftMargin + cellWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5, tableTop + 5, { width: cellWidths[i], align: 'center' });
  });

  resultados.forEach((resultado, i) => {
      const y = tableTop + (i + 1) * itemHeight;
      if (i % 2 === 0) {
          doc.fillColor('#f9f9f9').rect(leftMargin, y, totalTableWidth, itemHeight).fill();
      }

      let xPosition = leftMargin;
      doc.fillColor('#333333').font('Helvetica');

      doc.text(resultado.nombre, xPosition + 5, y + 5, { width: cellWidths[0], align: 'center' });
      xPosition += cellWidths[0];
      doc.text(resultado.apellido, xPosition + 5, y + 5, { width: cellWidths[1], align: 'center' });
      xPosition += cellWidths[1];
      doc.text(resultado.apellido2 || '', xPosition + 5, y + 5, { width: cellWidths[2], align: 'center' });
      xPosition += cellWidths[2];
      doc.text(resultado.correctas.toString(), xPosition + 5, y + 5, { width: cellWidths[3], align: 'center' });
      xPosition += cellWidths[3];
      const incorrectas = resultado.total - resultado.correctas;
      doc.text(incorrectas.toString(), xPosition + 5, y + 5, { width: cellWidths[4], align: 'center' });
      xPosition += cellWidths[4];
      doc.text(resultado.total.toString(), xPosition + 5, y + 5, { width: cellWidths[5], align: 'center' });
      xPosition += cellWidths[5];
      doc.text(resultado.nota.toString(), xPosition + 5, y + 5, { width: cellWidths[6], align: 'center' });
      xPosition += cellWidths[6];
      doc.text(resultado.tiempoTranscurrido.toString() + " min", xPosition + 5, y + 5, { width: cellWidths[7], align: 'center' });
  });
}

// Función para generar la tabla de libro y tema
function generateLibroTemaTable(doc, registros) {
  const tableTop = 250;
  const itemHeight = 20;
  const cellWidths = [50, 50, 50, 85, 30, 60, 60, 65, 30, 60];  // Anchos para las columnas

  const totalTableWidth = cellWidths.reduce((a, b) => a + b, 0);
  const leftMargin = (doc.page.width - totalTableWidth) / 2;

  // Dibujar el encabezado de la tabla
  doc.fontSize(12).fillColor('white').rect(leftMargin, tableTop, totalTableWidth, itemHeight).fill('#007bff');
  const headers = ["Nombre", "Paterno", "Materno", "Tema", "Libro", "Dificultad", "Correctas", "Incorrectas", "Nota", "Estado"];
  headers.forEach((header, i) => {
      doc.fillColor('white').font('Helvetica-Bold').text(header, leftMargin + cellWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5, tableTop + 5, { width: cellWidths[i], align: 'center' });
  });

  // Dibujar las filas de los registros
  registros.forEach((registro, i) => {
      const y = tableTop + (i + 1) * itemHeight;
      if (i % 2 === 0) {
          doc.fillColor('#f9f9f9').rect(leftMargin, y, totalTableWidth, itemHeight).fill();  // Alternar color en las filas
      }

      let xPosition = leftMargin;
      doc.fillColor('#333333').font('Helvetica');

      const incorrectas = registro.resultado.total - registro.resultado.correctas;
      const estado = registro.resultado.nota >= 6 ? 'Aprobado' : 'Reprobado';

      // Llenar cada columna con los datos correctos
      doc.text(registro.resultado.nombre, xPosition + 5, y + 5, { width: cellWidths[0], align: 'center' });
      xPosition += cellWidths[0];
      doc.text(registro.resultado.apellido, xPosition + 5, y + 5, { width: cellWidths[1], align: 'center' });
      xPosition += cellWidths[1];
      doc.text(registro.resultado.apellido2 || '', xPosition + 5, y + 5, { width: cellWidths[2], align: 'center' });
      xPosition += cellWidths[2];
      doc.text(registro.examen.tema, xPosition + 5, y + 5, { width: cellWidths[3], align: 'center' });
      xPosition += cellWidths[3];
      doc.text(registro.examen.libro, xPosition + 5, y + 5, { width: cellWidths[4], align: 'center' });
      xPosition += cellWidths[4];
      doc.text(registro.examen.dificultad || 'N/A', xPosition + 5, y + 5, { width: cellWidths[5], align: 'center' });
      xPosition += cellWidths[5];
      doc.text(registro.resultado.correctas.toString(), xPosition + 5, y + 5, { width: cellWidths[6], align: 'center' });
      xPosition += cellWidths[6];
      doc.text(incorrectas.toString(), xPosition + 5, y + 5, { width: cellWidths[7], align: 'center' });
      xPosition += cellWidths[7];
      doc.text(registro.resultado.nota.toString(), xPosition + 5, y + 5, { width: cellWidths[8], align: 'center' });
      xPosition += cellWidths[8];
      doc.text(estado, xPosition + 5, y + 5, { width: cellWidths[9], align: 'center' });
  });
}


// Ruta para obtener todos los estudiantes inscritos
appExpress.get('/estudiantesInscritos', async (req, res) => {
  try {
    const estudiantes = await Estudiante.find(); // Obtener todos los estudiantes
    res.json(estudiantes); // Devolver los estudiantes en formato JSON
  } catch (error) {
    console.error('Error al obtener los estudiantes inscritos:', error);
    res.status(500).send('Error al obtener los estudiantes inscritos');
  }
});

// Obtener estudiantes por nivel GRAFICO
appExpress.get('/obtenerEstudiantesPorNivel', async (req, res) => {
  try {
      const basico = await Estudiante.countDocuments({ nivel: 'basico' });
      const intermedio = await Estudiante.countDocuments({ nivel: 'intermedio' });
      const avanzado = await Estudiante.countDocuments({ nivel: 'avanzado' });

      res.json({ basico, intermedio, avanzado });
  } catch (error) {
      console.error('Error al obtener estudiantes por nivel:', error);
      res.status(500).send('Error al obtener los datos');
  }
});

// Ruta de inicio de sesion del Estudiante 
appExpress.post('/loginEstudiante', async (req, res) => {
  const { email, telefono } = req.body;

  try {
    const estudiante = await Estudiante.findOne({ email, telefono });

    if (!estudiante) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // Devolver los datos del estudiante
    res.json({
      message: 'Autenticación exitosa',
      estudiante: {
        nombre: estudiante.nombre,
        apellido: estudiante.apellido,
        apellido2: estudiante.apellido2,
        nivel: estudiante.nivel
      }
    });

  } catch (dbError) {
    console.error('Error al acceder a la base de datos:', dbError);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Nueva ruta para inicio de sesión en la aplicación móvil que devuelve nivel y token
appExpress.post('/loginEstudianteToken', async (req, res) => {
  const { email } = req.body;

  try {
    const estudiante = await Estudiante.findOne({ email });

    if (!estudiante) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    if (estudiante.isLoggedIn) {
      return res.status(403).json({ message: 'Ya tienes una sesión activa.' });
    }

    // Marcar al estudiante como conectado
    estudiante.isLoggedIn = true;
    await estudiante.save();

    res.json({
      message: 'Autenticación exitosa',
      nivel: estudiante.nivel,
      token: 'GENERATE_YOUR_TOKEN_HERE', // puedes generar un token si es necesario
    });

  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

//Ruta para cerrar
appExpress.post('/logoutEstudiante', async (req, res) => {
  const { email } = req.body;

  try {
    const estudiante = await Estudiante.findOne({ email });

    if (!estudiante) {
      return res.status(400).json({ message: 'Estudiante no encontrado' });
    }

    // Marcar la sesión como cerrada
    estudiante.isLoggedIn = false;
    await estudiante.save();

    res.json({ message: 'Sesión cerrada correctamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cerrar sesión.' });
  }
});

// obtener la cantidad de aprobados y reprobados GRAFICO
appExpress.get('/resultadosAprobadosReprobados', async (req, res) => {
  try {
    // Obtener todos los resultados
    const resultados = await Resultado.find();

    // Contadores
    let aprobados = 0;
    let reprobados = 0;

    // Contar los estudiantes aprobados y reprobados
    resultados.forEach(resultado => {
      if (resultado.nota >= 5.1) {
        aprobados++;
      } else {
        reprobados++;
      }
    });

    // Responder con la cantidad de aprobados y reprobados
    res.json({ aprobados, reprobados });
  } catch (error) {
    console.error('Error al obtener los resultados:', error);
    res.status(500).send('Error al obtener los resultados');
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

// Ruta para eliminar seguimiento
appExpress.delete('/seguimiento/:id', async (req, res) => {
  const seguimientoId = req.params.id;
  try {
    const seguimiento = await Seguimiento.findByIdAndDelete(seguimientoId);
    if (!seguimiento) {
      return res.status(404).send('Registro de seguimiento no encontrado');
    }
    res.status(200).send('Registro eliminado exitosamente');
  } catch (error) {
    console.error('Error al eliminar el seguimiento:', error);
    res.status(500).send('Error al eliminar el registro');
  }
});

// Ruta del seguimiento al estudiante al ingresar al sistema
appExpress.get('/seguimiento', async (req, res) => {
  try {
    const seguimiento = await Seguimiento.find();
    res.json(seguimiento);
  } catch (err) {
    console.error('Error al obtener el seguimiento de ingresos:', err);
    res.status(500).send('Error al obtener el seguimiento de ingresos');
  }
});

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

      // Registrar el ingreso del estudiante
      const nuevoSeguimiento = new Seguimiento({
        nombre: estudiante.nombre,
        apellido: estudiante.apellido,
        email: estudiante.email,
        telefono: estudiante.telefono,
        horaIngreso: new Date()
      });

      await nuevoSeguimiento.save();

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