// __tests__/generaciontoken.test.js
const { generarTokenPersonalizado, generarPalabrasClave } = require('../GeneracionToken');

describe('Pruebas de funciones de generación de token', () => {
  test('generarPalabrasClave debe retornar un array de la longitud especificada', () => {
    const longitud = 5;
    const palabras = generarPalabrasClave(longitud);
    expect(palabras).toHaveLength(longitud);
  });

  test('generarPalabrasClave debe retornar un array de palabras', () => {
    const palabras = generarPalabrasClave(5);
    palabras.forEach(palabra => {
      expect(typeof palabra).toBe('string');
    });
  });

  test('generarTokenPersonalizado debe retornar un token válido con palabras clave y tiempos correctos', () => {
    const palabrasClave = generarPalabrasClave(3);
    const ttlMinutes = 60;
    const result = generarTokenPersonalizado(palabrasClave, ttlMinutes);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('creationTime');
    expect(result).toHaveProperty('expiresAt');
    expect(result).toHaveProperty('ttlMinutes');
    expect(result).toHaveProperty('palabrasClave');
    expect(result.token).toHaveLength(64);
    expect(result.palabrasClave).toEqual(palabrasClave);
  });
});
