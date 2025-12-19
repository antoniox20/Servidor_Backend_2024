import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 50, // Número de usuarios virtuales simulados
    duration: '30s', // Duración de la prueba
};

export default function () {
    // Definir las rutas que deseas probar
    let loginRes = http.post('https://a42f-189-28-66-50.ngrok-free.app/loginEstudianteToken', {
        email: 'testuser@example.com'
    });

    // Verificar que el login fue exitoso
    check(loginRes, {
        'login status is 200': (r) => r.status === 200,
    });

    // Realizar otras solicitudes después de iniciar sesión, si es necesario
    let examenesRes = http.get('https://a42f-189-28-66-50.ngrok-free.app/examenesPorNivel?nivel=basico');
    
    check(examenesRes, {
        'get examenes status is 200': (r) => r.status === 200,
    });

    // Pausa entre solicitudes para simular usuarios reales
    sleep(1);
}

