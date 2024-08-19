const crypto = require('crypto');
//const jwt = require('jsonwebtoken');
//const secretKey = '47270429eef774f9b4708b774c6bee3c0d9d6f7fa6ed8c7e8929829ab675a481'; 
const { generarTokenPersonalizado, generarPalabrasClave } = require('./GeneracionToken');

const GenerarExamen = (tema, tiposPreguntas, numeroOpciones, dificultad) => {
    console.log('Generando preguntas con los siguientes parámetros:', { tema, tiposPreguntas, numeroOpciones, dificultad });

    const preguntas = [];
    const tipos = Array.isArray(tiposPreguntas) ? tiposPreguntas : tiposPreguntas.split(',');

    // Función para asegurar que la respuesta correcta siempre esté incluida
    const incluirRespuestaCorrecta = (opciones, respuestaCorrecta, numeroOpciones) => {
        const allOptions = [respuestaCorrecta, ...opciones.filter(op => op !== respuestaCorrecta)];
        const shuffledOptions = shuffleArray(allOptions).slice(0, numeroOpciones);

        if (!shuffledOptions.includes(respuestaCorrecta)) {
            shuffledOptions[shuffledOptions.length - 1] = respuestaCorrecta;
        }
        return shuffleArray(shuffledOptions);
    };

    // Definición de preguntas por nivel
    const preguntasNivelBasico = [
        {
            pregunta: `What is the correct form of the verb in this sentence? I ______ (to go) to school every day.`,
            opciones: ["goes", "go", "gone", "going", "goed"],
            respuestaCorrecta: "go"
        },
        {
            pregunta: `Vocabulary - Common Objects: Which of the following is a piece of furniture?`,
            opciones: ["Apple", "Chair", "Dog", "Car", "Cat"],
            respuestaCorrecta: "Chair"
        },
        {
            pregunta: `Prepositions of Place: Where is the book? It is ______ the table.`,
            opciones: ["on", "in", "under", "next", "over"],
            respuestaCorrecta: "on"
        },
        {
            pregunta: `Pronouns: Choose the correct pronoun for the sentence: "Maria is my friend. ______ is very nice.`,
            opciones: ["He", "She", "It", "They", "Her"],
            respuestaCorrecta: "She"
        },
        {
            pregunta: `Adjectives: Which adjective best completes the sentence? "The weather today is very ______.`,
            opciones: ["happy", "cold", "quickly", "always", "hot"],
            respuestaCorrecta: "cold"
        },
        {
            pregunta: `Present Continuous Tense: What is the correct form of the verb in this sentence? "They ______ (to play) soccer right now.`,
            opciones: ["is playing", "are playing", "plays", "played", "play"],
            respuestaCorrecta: "are playing"
        },
        {
            pregunta: `Conjunctions: Choose the correct conjunction to complete the sentence: "I want to go to the park ______ it is raining.`,
            opciones: ["but", "or", "so", "and", "because"],
            respuestaCorrecta: "but"
        },
        {
            pregunta: `Numbers: What is the correct way to write the number 15 in words?`,
            opciones: ["fifthteen", "fifteen", "fifty", "five teen", "fiften"],
            respuestaCorrecta: "fifteen"
        },
        {
            pregunta: `Frequency Adverbs: Which adverb best completes the sentence? "She ______ goes to the gym.`,
            opciones: ["always", "never", "sometimes", "rarely", "forever"],
            respuestaCorrecta: "always"
        },
        {
            pregunta: `Time Expressions: Choose the correct word to complete the sentence: "We have English class ______ Monday.`,
            opciones: ["at", "in", "a", "on", "to"],
            respuestaCorrecta: "on"
        }
    ];

    const preguntasNivelIntermedio = [
        {
            pregunta: `Past Simple Tense: What is the correct form of the verb in this sentence? "Yesterday, I ______ (to watch) a movie.`,
            opciones: ["watch", "watched", "watching", "watches", "was watching"],
            respuestaCorrecta: "watched"
        },
        {
            pregunta: `Comparatives: Which word correctly completes the sentence? "John is ______ than Peter.`,
            opciones: ["tall", "taller", "tallest", "more tall", "tallest"],
            respuestaCorrecta: "taller"
        },
        {
            pregunta: `Possessive Adjectives: Choose the correct possessive adjective for the sentence: "This is ______ book.`,
            opciones: ["my", "me", "I", "mine", "mine's"],
            respuestaCorrecta: "my"
        },
        {
            pregunta: `Modals: Which modal verb best completes the sentence? "You ______ finish your homework before going out.`,
            opciones: ["can", "must", "would", "might", "could"],
            respuestaCorrecta: "must"
        },
        {
            pregunta: `Future Tense: What is the correct form of the verb in this sentence? "Tomorrow, she ______ (to visit) her grandmother.`,
            opciones: ["visits", "visit", "will visit", "visiting", "is visiting"],
            respuestaCorrecta: "will visit"
        },
        {
            pregunta: `Conditionals: Choose the correct word to complete the sentence: "If it ______ (to rain), we will stay home.`,
            opciones: ["rains", "rained", "raining", "rain", "is raining"],
            respuestaCorrecta: "rains"
        },
        {
            pregunta: `Phrasal Verbs: Choose the correct phrasal verb to complete the sentence: "She looks ______ her little sister.`,
            opciones: ["after", "up", "for", "with", "at"],
            respuestaCorrecta: "after"
        },
        {
            pregunta: `Passive Voice: Choose the correct passive form: "The book ______ (to write) by the author in 1999.`,
            opciones: ["was written", "is written", "wrote", "is writing", "was writing"],
            respuestaCorrecta: "was written"
        },
        {
            pregunta: `Reported Speech: Choose the correct sentence: "He said that he ______ (to go) to the party.`,
            opciones: ["go", "went", "gone", "going", "will go"],
            respuestaCorrecta: "went"
        },
        {
            pregunta: `Relative Clauses: Choose the correct word to complete the sentence: "The man ______ lives next door is very friendly.`,
            opciones: ["who", "which", "whose", "whom", "that"],
            respuestaCorrecta: "who"
        }
    ];

    const preguntasNivelAvanzado = [
        {
            pregunta: `Subjunctive Mood: Choose the correct form: "I suggest that he ______ (to be) on time.`,
            opciones: ["is", "are", "be", "was", "were"],
            respuestaCorrecta: "be"
        },
        {
            pregunta: `Past Perfect Tense: What is the correct form of the verb in this sentence? "By the time we arrived, they ______ (to leave).`,
            opciones: ["left", "leaves", "had left", "have left", "was leaving"],
            respuestaCorrecta: "had left"
        },
        {
            pregunta: `Conditional Sentences: Choose the correct form: "If I ______ (to know) the answer, I would tell you.`,
            opciones: ["knew", "know", "knowing", "known", "knows"],
            respuestaCorrecta: "knew"
        },
        {
            pregunta: `Inversion: Choose the correct sentence: "Rarely ______ (to see) such talent.`,
            opciones: ["we see", "do we see", "we does see", "does we see", "we seeing"],
            respuestaCorrecta: "do we see"
        },
        {
            pregunta: `Cleft Sentences: Choose the correct form: "It was in Paris that we ______ (to meet) for the first time.`,
            opciones: ["meet", "meets", "met", "meeting", "was meeting"],
            respuestaCorrecta: "met"
        },
        {
            pregunta: `Future Perfect Tense: What is the correct form of the verb in this sentence? "By next year, I ______ (to graduate).`,
            opciones: ["will graduate", "graduate", "will have graduated", "graduated", "am graduating"],
            respuestaCorrecta: "will have graduated"
        },
        {
            pregunta: `Gerunds and Infinitives: Choose the correct form: "I look forward to ______ (to meet) you.`,
            opciones: ["meet", "meeting", "meets", "to meet", "met"],
            respuestaCorrecta: "meeting"
        },
        {
            pregunta: `Complex Sentences: Choose the correct form: "No sooner ______ (to arrive) than it started to rain.`,
            opciones: ["we arrive", "do we arrive", "had we arrived", "we had arrived", "arrived we"],
            respuestaCorrecta: "had we arrived"
        },
        {
            pregunta: `Reported Questions: Choose the correct form: "She asked me where I ______ (to live).`,
            opciones: ["live", "living", "lived", "lives", "was live"],
            respuestaCorrecta: "lived"
        },
        {
            pregunta: `Idiomatic Expressions: Choose the correct completion: "He let the cat out of the ______.`,
            opciones: ["bag", "box", "house", "cage", "room"],
            respuestaCorrecta: "bag"
        }
    ];

    const preguntasVFBasico = [
        {
            pregunta: `The sky is blue.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Dogs can fly.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "False"
        },
        {
            pregunta: `Water is wet.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Fish can live on land.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "False"
        },
        {
            pregunta: `The sun rises in the east.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Cats are mammals.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Birds have feathers.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The Earth is flat.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "False"
        },
        {
            pregunta: `Apples are a type of fruit.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Humans need water to survive.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        }
    ];

    const preguntasVFIntermedio = [
        {
            pregunta: `The capital of France is Paris.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Mount Everest is the highest mountain in the world.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The Pacific Ocean is the smallest ocean on Earth.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "False"
        },
        {
            pregunta: `Albert Einstein developed the theory of relativity.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The Great Wall of China is visible from space.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "False"
        },
        {
            pregunta: `The human body has 206 bones.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Venus is the closest planet to the Sun.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "False"
        },
        {
            pregunta: `The Nile is the longest river in the world.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Photosynthesis occurs in the leaves of plants.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The chemical symbol for iron is Fe.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        }
    ];

    const preguntasVFAvanzado = [
        {
            pregunta: `The theory of evolution was proposed by Charles Darwin.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Light travels faster than sound.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The chemical symbol for gold is Au.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `Shakespeare wrote "To be, or not to be".`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The human brain is the largest organ in the human body.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "False"
        },
        {
            pregunta: `Quantum mechanics is a fundamental theory in physics.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The speed of light is approximately 300,000 kilometers per second.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `DNA stands for Deoxyribonucleic Acid.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `The Pythagorean Theorem is used to find the sides of a right triangle.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        },
        {
            pregunta: `E=mc^2 is an equation in Einstein's theory of relativity.`,
            opciones: ["True", "False"],
            respuestaCorrecta: "True"
        }
    ];
    
    //Preguntas Linstening
    const preguntasListeningBasico = [
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico1.mp3",
            opciones: ["The cat is on the table", "The cat is under the table", "The cat is next to the table", "The cat is flow the table.", "The cat is off the table."],
            respuestaCorrecta: "The cat is on the table"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico2.mp3",
            opciones: ["I like cherries.", "I like bananas", "I like oranges", "I like grapes.", "I like apples"],
            respuestaCorrecta: "I like apples"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico3.mp3",
            opciones: ["London", "Rome", "Paris","Berlin","Madrid"],
            respuestaCorrecta: "Paris"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico4.mp3",
            opciones: ["Monday", "Tuesday", "Friday", "Wednesday", "Thursday"],
            respuestaCorrecta: "Friday"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico5.mp3",
            opciones: ["Four", "Two", "One", "Three", "Five"],
            respuestaCorrecta: "Two"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico6.mp3",
            opciones: ["3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"],
            respuestaCorrecta: "5:00 PM"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico7.mp3",
            opciones: ["Next to the park", "Across from the library", "Behind the school", "In front of the bank", "Beside the hospital"],
            respuestaCorrecta: "Across from the library"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico8.mp3",
            opciones: ["Bread", "Milk", "Eggs", "Apples", "Cheese"],
            respuestaCorrecta: "Bread"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico9.mp3",
            opciones: ["By car", "By bus", "By bicycle", "On foot", "By train"],
            respuestaCorrecta: "By bus"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_basico10.mp3",
            opciones: ["Sunny", "Rainy", "Cloudy", "Snowy", "Windy"],
            respuestaCorrecta: "Sunny"
        }
    ];

    const preguntasListeningIntermedio = [
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio1.mp3",
            opciones: ["He went to the cinema", "He went to the park", "He went to the supermarket", "He went to the Library", "He went to the Hospital"],
            respuestaCorrecta: "He went to the cinema"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio2.mp3",
            opciones: ["She works as a teacher", "She works as a doctor", "She works as a lawyer", "She works as a Engineer ", "She works as a Nurse"],
            respuestaCorrecta: "She works as a doctor"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio3.mp3",
            opciones: ["They are going to visit Paris", "They are going to visit London", "They are going to visit New York", "They are going to visit Berlin", "They are going to visit Rome"],
            respuestaCorrecta: "They are going to visit Paris"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio4.mp3",
            opciones: ["He is playing football", "He is playing basketball", "He is playing tennis", "He is playing Golf", "He is playing Baseball"],
            respuestaCorrecta: "He is playing tennis"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio5.mp3",
            opciones: ["She has two sisters", "She has two brothers", "She has one sister and one brother", "She has No siblings ", "She has Three sisters"],
            respuestaCorrecta: "She has one sister and one brother"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio6.mp3",
            opciones: ["She forgot her passport.", "She got stuck in traffic.", "She overslept.", "She lost her ticket.", "She was at the wrong gate."],
            respuestaCorrecta: "She got stuck in traffic."
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio7.mp3",
            opciones: ["It needs more funding.", "It will be delayed.", "It was approved.", "It has been cancelled.", "It needs more staff."],
            respuestaCorrecta: "It was approved."
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio8.mp3",
            opciones: ["The mountains", "The beach", "The city", "The countryside", "The amusement park"],
            respuestaCorrecta: "The beach"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio9.mp3",
            opciones: ["It was broken.", "It was the wrong color.", "It was too expensive.", "It was out of stock.", "It was the wrong size."],
            respuestaCorrecta: "It was broken."
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_intermedio10.mp3",
            opciones: ["By working overtime", "By hiring more people", "By changing the plan", "By outsourcing the work", "By using new software"],
            respuestaCorrecta: "By changing the plan"
        }
    ];

    const preguntasListeningAvanzado = [
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado1.mp3",
            opciones: ["The meeting is at 3 PM", "The meeting is at 4 PM", "The meeting is at 5 PM", "The meeting is at 7 PM", "The meeting is at 6 PM"],
            respuestaCorrecta: "The meeting is at 3 PM"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado2.mp3",
            opciones: ["The conference will be held in June", "The conference will be held in July", "The conference will be held in August", "The conference will be held in October ", "The conference will be held in September "],
            respuestaCorrecta: "The conference will be held in July"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado3.mp3",
            opciones: ["He graduated with honors", "He graduated with distinction", "He graduated with a pass", "He graduated with Merit", "He graduated with Excellence"],
            respuestaCorrecta: "He graduated with honors"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado4.mp3",
            opciones: ["They discussed the new project", "They discussed the financial report", "They discussed the marketing strategy", "They discussed the Sales figures", "They discussed the Annual budget"],
            respuestaCorrecta: "They discussed the marketing strategy"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado5.mp3",
            opciones: ["The flight was delayed by two hours", "The flight was canceled", "The flight was on time", "The flight was Rescheduled ", "The flight was Diverted"],
            respuestaCorrecta: "The flight was delayed by two hours"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado6.mp3",
            opciones: ["Climate change", "Economic policies", "Technological advancements", "Historical events", "Social dynamics"],
            respuestaCorrecta: "Climate change"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado7.mp3",
            opciones: ["Reducing prices", "Increasing marketing efforts", "Expanding to new markets", "Enhancing product quality", "Offering discounts"],
            respuestaCorrecta: "Increasing marketing efforts"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado8.mp3",
            opciones: ["Lack of funding", "Inaccurate data", "Equipment malfunction", "Insufficient sample size", "Ethical concerns"],
            respuestaCorrecta: "Equipment malfunction"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado9.mp3",
            opciones: ["Cost-effectiveness", "Environmental benefits", "Job creation", "Energy independence", "Technological innovation"],
            respuestaCorrecta: "Environmental benefits"
        },
        {
            pregunta: `Listen to the audio and select the correct answer.`,
            audio: "./audios/audio_avanzado10.mp3",
            opciones: ["With protests", "With support", "With indifference", "With confusion", "With skepticism"],
            respuestaCorrecta: "With support"
        }
    ];

    const obtenerPreguntasPorDificultadYTipo = (dificultad, tipo) => {
        const todasLasPreguntas = {
            facil: {
                opcionMultiple: preguntasNivelBasico,
                verdaderoFalso: preguntasVFBasico,
                listening: preguntasListeningBasico,
            },
            medio: {
                opcionMultiple: preguntasNivelIntermedio,
                verdaderoFalso: preguntasVFIntermedio,
                listening: preguntasListeningIntermedio,
            },
            dificil: {
                opcionMultiple: preguntasNivelAvanzado,
                verdaderoFalso: preguntasVFAvanzado,
                listening: preguntasListeningAvanzado,
            },
        };
        return todasLasPreguntas[dificultad][tipo] || [];
    };

    tipos.forEach(tipoPregunta => {
        const basePreguntas = obtenerPreguntasPorDificultadYTipo(dificultad, tipoPregunta);
        
        basePreguntas.forEach(baseQuestion => {
            let question = { ...baseQuestion };

            if (tipoPregunta === 'opcionMultiple' || tipoPregunta === 'listening') {
                question.opciones = incluirRespuestaCorrecta(baseQuestion.opciones, baseQuestion.respuestaCorrecta, numeroOpciones);
            } else if (tipoPregunta === 'verdaderoFalso') {
                question.opciones = ["True", "False"];
            }

            preguntas.push(question);
        });
    });
    
    const palabrasClave = generarPalabrasClave(5);
    const { token, creationTime, expiresAt, ttlMinutes } = generarTokenPersonalizado(palabrasClave);
    console.log('Preguntas generadas:', preguntas);
    console.log('Token único generado:', token);
    console.log('Expiración del token:', expiresAt);
    console.log('Tiempo de vida del token (minutos):', ttlMinutes);
    return { preguntas, token, creationTime, expiresAt, ttlMinutes, palabrasClave };
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

module.exports = {
    generateQuestions: GenerarExamen
};
