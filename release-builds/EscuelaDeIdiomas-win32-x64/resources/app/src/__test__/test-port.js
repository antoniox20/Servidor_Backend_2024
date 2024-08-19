const portInUse = require('port-in-use');

// Verifica si el puerto 3000 está en uso
portInUse(3000).then(inUse => {
    console.log(`El puerto 3000 ${inUse ? 'está en uso' : 'no está en uso'}`);
}).catch(err => {
    console.error(`Error: ${err}`);
});
