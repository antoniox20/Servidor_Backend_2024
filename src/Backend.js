// backend.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io'); 
const cors = require('cors'); 

const Usuario = require('./Entidades/Usuario');
const Estudiante = require('./Entidades/Estudiantes');
const Examen = require('./Entidades/Examen');
const Pregunta = require('./Entidades/Preguntas');
const Resultado = require('./Entidades/Resultados'); 
const Seguimiento = require('./Entidades/Seguimiento');
const { generateQuestions } = require('./generacion');

const appExpress = express();
const server = http.createServer(appExpress); 
const io = socketIO(server);

appExpress.use(cors());
appExpress.use(bodyParser.json());
appExpress.use(bodyParser.urlencoded({ extended: true }));

// Crear la carpeta uploads si no existe
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

// Conectar a MongoDB
mongoose.connect('mongodb+srv://antoniotaboada777:0ZJ1alGXsIqPOzln@cluster0.kxioi.mongodb.net/loginApp?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB para loginApp'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// Socket.IO
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Rutas y funcionalidades

// Ruta para obtener los datos del estudiante por el token
appExpress.get('/obtenerExamenPorToken', async (req, res) => {
  const { token } = req.query;

  try {
    const resultado = await Resultado.findOne({ token });
    if (resultado) {
      return res.status(400).json({ message: 'Este examen ya ha sido resuelto.' });
    }

    const examen = await Examen.findOne({ token });
    if (!examen) {
      return res.status(404).json({ message: 'Token no encontrado' });
    }

    const estudiante = await Estudiante.findOne({ examenAsignado: token });
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }

    res.json({
      exito: true,
      estudiante: {
        nombre: estudiante.nombre,
        apellido: estudiante.apellido,
        apellido2: estudiante.apellido2,  
        nivel: estudiante.nivel           
      },
      preguntas: examen.preguntas,
      tiempoRestante: examen.tiempo 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el examen', error });
  }
});

// Ruta para subir preguntas con carga de audio
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

// Ruta para calificar examen y guardar resultado
appExpress.post('/calificarExamen', async (req, res) => {
  const { token, nombre, apellido, respuestas } = req.body;

  try {
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

    res.send({ correctas, total, nota, detalles });
  } catch (error) {
    console.error('Error al calificar el examen:', error);
    res.status(500).send('Error al calificar el examen');
  }
});

// Ruta para recuperar notas
appExpress.get('/obtenerResultados', async (req, res) => {
  try {
    const resultados = await Resultado.find();
    res.json(resultados);
  } catch (error) {
    console.error('Error al obtener los resultados:', error);
    res.status(500).send('Error al obtener los resultados');
  }
});

// Ruta para eliminar examen
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

// Rutas para manejo de exámenes
appExpress.post('/generarExamen', async (req, res) => {
  const { titulo, descripcion, tema, libro, tiposPreguntas, numeroOpciones, dificultad, contenidoHTML, fechaCreacion, tiempo } = req.body;

  const { preguntas, token, expiresAt, palabrasClave } = generateQuestions(tema, tiposPreguntas, numeroOpciones, dificultad);

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
    tiempo: parseInt(tiempo, 10) * 60, 
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

// Ruta para verificar el token del examen
appExpress.post('/verificarToken', async (req, res) => {
  const { token } = req.body;

  try {
    const resultado = await Resultado.findOne({ token });
    if (resultado) {
      return res.status(400).json({ message: 'Este examen ya ha sido resuelto.' });
    }

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
  const { nombre, apellido, apellido2, fechaDeNacimiento, email, telefono, nivel, examenAsignado } = req.body;

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
      examenAsignado
    });

    await nuevoEstudiante.save();
    res.status(201).send('Estudiante registrado exitosamente');
  } catch (err) {
    console.error('Error al registrar al estudiante:', err);
    res.status(500).send('Error al registrar al estudiante');
  }
});

// Ruta para asignar examen a un estudiante
appExpress.post('/asignarExamen', async (req, res) => {
  const { estudianteId, examenToken } = req.body;

  try {
    const estudianteConExamen = await Estudiante.findOne({ examenAsignado: examenToken });

    if (estudianteConExamen) {
      return res.status(400).send('Este examen ya ha sido asignado a otro estudiante.');
    }

    const estudiante = await Estudiante.findById(estudianteId);
    if (!estudiante) {
      return res.status(404).send('Estudiante no encontrado');
    }

    estudiante.examenAsignado = examenToken;
    await estudiante.save();

    res.status(200).send('Examen asignado exitosamente');
  } catch (error) {
    console.error('Error al asignar el examen:', error);
    res.status(500).send('Error al asignar el examen');
  }
});

// Ruta para obtener exámenes clasificados por nivel
appExpress.get('/examenesPorNivel', async (req, res) => {
  try {
    const basico = await Examen.find({ dificultad: 'facil' }).select('token');
    const intermedio = await Examen.find({ dificultad: 'medio' }).select('token');
    const avanzado = await Examen.find({ dificultad: 'dificil' }).select('token');

    res.json({ basico, intermedio, avanzado });
  } catch (error) {
    console.error('Error al obtener los exámenes por nivel:', error);
    res.status(500).send('Error al obtener los exámenes por nivel');
  }
});

// Rutas para seguimiento de estudiantes
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

appExpress.get('/seguimiento', async (req, res) => {
  try {
    const seguimiento = await Seguimiento.find();
    res.json(seguimiento);
  } catch (err) {
    console.error('Error al obtener el seguimiento de ingresos:', err);
    res.status(500).send('Error al obtener el seguimiento de ingresos');
  }
});

// Iniciar el servidor en un puerto disponible
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor Express con socket.io corriendo en http://localhost:${PORT}`);
});
