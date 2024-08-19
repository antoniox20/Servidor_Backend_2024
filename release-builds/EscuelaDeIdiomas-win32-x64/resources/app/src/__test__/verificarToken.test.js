const { verificarTokenPersonalizado } = require('../VerificarToken');
const crypto = require('crypto');

describe('Pruebas de la función verificarTokenPersonalizado', () => {
  const SALT = '9jf83hfnskd73jdfg!93jnd@k#34nsf4';
  const palabrasClave = ['planificación', 'coordinación', 'desarrollo'];
  const creationTime = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora después

  test('debe devolver true para un token válido', () => {
    const baseString = `${palabrasClave.join('-')}:${creationTime}:${expirationTime}:${SALT}`;
    const tokenValido = crypto.createHash('sha256').update(baseString).digest('hex');

    const resultado = verificarTokenPersonalizado(tokenValido, palabrasClave, creationTime, expirationTime);
    expect(resultado).toBe(true);
    console.log('Prueba exitosa: El token válido ha sido verificado correctamente.');
  });

  test('debe devolver false para un token inválido', () => {
    const tokenInvalido = 'token_incorrecto';

    const resultado = verificarTokenPersonalizado(tokenInvalido, palabrasClave, creationTime, expirationTime);
    expect(resultado).toBe(false);
    console.log('Prueba exitosa: El token inválido ha sido rechazado correctamente.');
  });

  test('debe devolver false para un token con palabras clave incorrectas', () => {
    const palabrasClaveIncorrectas = ['incorrecto', 'clave', 'valor'];
    const baseString = `${palabrasClaveIncorrectas.join('-')}:${creationTime}:${expirationTime}:${SALT}`;
    const tokenIncorrecto = crypto.createHash('sha256').update(baseString).digest('hex');

    const resultado = verificarTokenPersonalizado(tokenIncorrecto, palabrasClave, creationTime, expirationTime);
    expect(resultado).toBe(false);
    console.log('Prueba exitosa: Token generado con palabras clave incorrectas no fue verificado.');
  });

  test('debe devolver false para un token con tiempos incorrectos', () => {
    const creationTimeIncorrecto = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hora antes
    const baseString = `${palabrasClave.join('-')}:${creationTimeIncorrecto}:${expirationTime}:${SALT}`;
    const tokenIncorrecto = crypto.createHash('sha256').update(baseString).digest('hex');

    const resultado = verificarTokenPersonalizado(tokenIncorrecto, palabrasClave, creationTime, expirationTime);
    expect(resultado).toBe(false);
    console.log('Prueba exitosa: Token generado con tiempos incorrectos no fue verificado.');
  });
});
