const crypto = require('crypto');

const palabrasInstitucion = [
    'planificación', 'coordinación', 'desarrollo', 'enseñanza', 'aprendizaje', 'idiomas', 
    'filiales', 'sucursales', 'territorio', 'nacional', 'capacitación', 'recursos', 
    'humanos', 'ejército', 'personal', 'civil', 'manejo', 'lenguas', 'dominio', 
    'misión', 'comando', 'institutos', 'militares', 'educación', 'centro', 'líder', 
    'excelencia', 'académico', 'eficiencia', 'competitividad', 'funciones', 'ámbito', 
    'internacional', 'responsabilidad', 'dignidad', 'liderazgo'
];

function generarPalabrasClave(longitud) {
    let palabrasClave = [];
    for (let i = 0; i < longitud; i++) {
        const indice = Math.floor(Math.random() * palabrasInstitucion.length);
        palabrasClave.push(palabrasInstitucion[indice]);
    }
    return palabrasClave;
}

function generarTokenPersonalizado(palabrasClave, ttlMinutes = 60) {
    const SALT = '9jf83hfnskd73jdfg!93jnd@k#34nsf4'; 
    const now = new Date();
    const creationTime = now.toISOString();
    const expirationTime = new Date(now.getTime() + ttlMinutes * 60000).toISOString();
    const baseString = `${palabrasClave.join('-')}:${creationTime}:${expirationTime}:${SALT}`;
    const hash = crypto.createHash('sha256').update(baseString).digest('hex');
    const bigintHash = BigInt('0x' + hash);
    const base36Token = bigintHash.toString(36).substring(0, 5);  
    return { token: base36Token, creationTime, expiresAt: expirationTime, ttlMinutes, palabrasClave };
}

module.exports = { generarTokenPersonalizado, generarPalabrasClave };
