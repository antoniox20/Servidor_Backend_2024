const crypto = require('crypto');

const SALT = '9jf83hfnskd73jdfg!93jnd@k#34nsf4';

// Lista de palabras clave específicas de la institución
const palabrasInstitucion = [
  'planificación', 'coordinación', 'desarrollo', 'enseñanza', 'aprendizaje', 'idiomas', 
  'filiales', 'sucursales', 'territorio', 'nacional', 'capacitación', 'recursos', 
  'humanos', 'ejército', 'personal', 'civil', 'manejo', 'lenguas', 'dominio', 
  'misión', 'comando', 'institutos', 'militares', 'educación', 'centro', 'líder', 
  'excelencia', 'académico', 'eficiencia', 'competitividad', 'funciones', 'ámbito', 
  'internacional', 'responsabilidad', 'dignidad', 'liderazgo'
];

// Función para verificar un token personalizado
const verificarTokenPersonalizado = (token, palabrasClave, creationTime, expirationTime) => {
  const baseString = `${palabrasClave.join('-')}:${creationTime}:${expirationTime}:${SALT}`;
  const expectedHash = crypto.createHash('sha256').update(baseString).digest('hex');
  return expectedHash === token;
};

module.exports = { verificarTokenPersonalizado };
