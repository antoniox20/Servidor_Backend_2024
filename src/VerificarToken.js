const crypto = require('crypto');

// Función para verificar el token
async function verificarToken(tokenProporcionado) {
    try {
        // 1. Buscar el examen correspondiente al token en la base de datos
        const examen = await Examen.findOne({ token: tokenProporcionado });

        if (!examen) {
            return { valid: false, message: 'Token no válido o expirado' };
        }

        // Extraer los datos del examen
        const { palabrasClave, creationTime, expiresAt } = examen;

        // 2. Reconstruir el baseString original
        const SALT = '9jf83hfnskd73jdfg!93jnd@k#34nsf4';
        const baseString = `${palabrasClave.join('-')}:${creationTime}:${expiresAt}:${SALT}`;

        // 3. Volver a generar el hash usando el baseString
        const hash = crypto.createHash('sha256').update(baseString).digest('hex');

        const bigintHash = BigInt('0x' + hash);  // Convertir el hash a BigInt
        const base36Token = bigintHash.toString(36).substring(0, 5);  // Convertir a base36 y tomar los primeros 5 caracteres

        // 4. Comparar el token proporcionado con el token reconstruido
        if (base36Token !== tokenProporcionado) {
            return { valid: false, message: 'Token manipulado o no válido' };
        }

        // 5. Verificar si el token ha expirado
        const now = new Date();
        if (now > new Date(examen.expiresAt)) {
            return { valid: false, message: 'Token ha expirado' };
        }

        // Si todo es correcto, el token es válido
        return { valid: true, message: 'Token válido', examen };

    } catch (error) {
        console.error("Error al verificar el token:", error);
        return { valid: false, message: 'Error en el proceso de verificación', error };
    }
}

module.exports = { verificarToken };
