export interface Character {
  id: string;
  name: string;
  originalName: string;
  team: 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveller' | 'fabled' | 'loric';
  edition: 'trouble-brewing' | 'bad-moon-rising' | 'sects-and-violets' | 'experimental' | 'fabled' | 'loric';
  ability: string;
  summary: string;
  firstNight?: string;
  otherNights?: string;
}

export const allBotcCharacters: Character[] = [
  // ==========================================
  // TROUBLE BREWING
  // ==========================================

  // --- Townsfolk ---
  {
    id: 'washerwoman',
    name: 'Lavandera',
    originalName: 'Washerwoman',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Empiezas sabiendo que 1 de 2 jugadores es un Aldeano específico.',
    summary: 'Proporciona información sólida al principio de la partida sobre un rol del bando bueno.'
  },
  {
    id: 'librarian',
    name: 'Bibliotecario',
    originalName: 'Librarian',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Empiezas sabiendo que 1 de 2 jugadores es un Forastero específico (o que no hay Forasteros).',
    summary: 'Ayuda a confirmar la presencia de Forasteros en juego y valida identidades.'
  },
  {
    id: 'investigator',
    name: 'Investigador',
    originalName: 'Investigator',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Empiezas sabiendo que 1 de 2 jugadores es un Esbirro específico.',
    summary: 'Detecta a una amenaza maligna clave desde la primera noche.'
  },
  {
    id: 'chef',
    name: 'Chef',
    originalName: 'Chef',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Empiezas sabiendo cuántos pares de jugadores malvados están sentados juntos.',
    summary: 'Proporciona información topológica clave sobre la posición de los jugadores malvados.'
  },
  {
    id: 'empath',
    name: 'Empático',
    originalName: 'Empath',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Cada noche, sabes cuántos de tus 2 vecinos vivos son malvados.',
    summary: 'Obtiene información dinámica que se refina a medida que sus vecinos van muriendo.'
  },
  {
    id: 'fortune-teller',
    name: 'Adivino',
    originalName: 'Fortune Teller',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Cada noche, elige 2 jugadores: sabes si alguno es el Demonio. Hay 1 buen jugador registrado como "Señuelo".',
    summary: 'Buscador continuo del demonio, con el desafío de identificar la falsa señal del Señuelo.'
  },
  {
    id: 'undertaker',
    name: 'Sepulturero',
    originalName: 'Undertaker',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Cada noche*, sabes qué rol tenía el jugador ejecutado durante el día.',
    summary: 'Confirma con precisión si los ejecutados en la plaza eran inocentes o culpables.'
  },
  {
    id: 'monk',
    name: 'Monje',
    originalName: 'Monk',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Cada noche*, elige a un jugador (no a ti): está protegido de los ataques del Demonio esa noche.',
    summary: 'Protector indispensable que puede anular el ataque nocturno del Mal.'
  },
  {
    id: 'ravenkeeper',
    name: 'Guardián del Cuervo',
    originalName: 'Ravenkeeper',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Si mueres de noche, despiertas y eliges a un jugador: descubres su rol exacto.',
    summary: 'Un objetivo letal si el Demonio comete el error de matarlo de noche.'
  },
  {
    id: 'virgin',
    name: 'Virgen',
    originalName: 'Virgin',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'La primera vez que te nominan, si el nominador es un Aldeano, es ejecutado inmediatamente.',
    summary: 'Mecanismo de confirmación infalible para demostrar la inocencia de dos jugadores.'
  },
  {
    id: 'slayer',
    name: 'Cazador',
    originalName: 'Slayer',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Una vez por partida, de día, elige un jugador público: si es el Demonio, muere.',
    summary: 'Un disparo de gracia diurno capaz de dar la victoria instantánea al pueblo.'
  },
  {
    id: 'soldier',
    name: 'Soldado',
    originalName: 'Soldier',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Eres inmune a los ataques del Demonio.',
    summary: 'Defensor inquebrantable que sirve de cebo y escudo natural contra el Demonio.'
  },
  {
    id: 'mayor',
    name: 'Alcalde',
    originalName: 'Mayor',
    team: 'townsfolk',
    edition: 'trouble-brewing',
    ability: 'Si solo quedan 3 jugadores vivos y no hay ejecución de día, tu bando gana. Si mueres de noche, otro jugador puede morir en tu lugar.',
    summary: 'Proporciona una condición de victoria alternativa pacífica en el desenlace del juego.'
  },

  // --- Outsiders ---
  {
    id: 'butler',
    name: 'Mayordomo',
    originalName: 'Butler',
    team: 'outsider',
    edition: 'trouble-brewing',
    ability: 'Cada noche, elige un Amo (otro jugador). Solo puedes votar si tu Amo también está votando.',
    summary: 'Forastero con restricción de voto que exige coordinación con su Amo.'
  },
  {
    id: 'drunk',
    name: 'Borracho',
    originalName: 'Drunk',
    team: 'outsider',
    edition: 'trouble-brewing',
    ability: 'Crees ser un Aldeano y recibes información como tal, pero tu habilidad no funciona.',
    summary: 'Siembra desconfianza e incertidumbre al distorsionar la información propia.'
  },
  {
    id: 'recluse',
    name: 'Recluso',
    originalName: 'Recluse',
    team: 'outsider',
    edition: 'trouble-brewing',
    ability: 'Podrías registrar como Malvado, Esbirro o Demonio para las habilidades de otros.',
    summary: 'Genera falsos positivos malignos que despistan a los detectives del pueblo.'
  },
  {
    id: 'saint',
    name: 'Santo',
    originalName: 'Saint',
    team: 'outsider',
    edition: 'trouble-brewing',
    ability: 'Si mueres ejecutado por el pueblo, tu bando pierde automáticamente.',
    summary: 'Forastero trágico que debe convencer al pueblo de jamás enviarlo a la horca.'
  },

  // --- Minions ---
  {
    id: 'poisoner',
    name: 'Envenenador',
    originalName: 'Poisoner',
    team: 'minion',
    edition: 'trouble-brewing',
    ability: 'Cada noche, elige un jugador: se envenena durante esa noche y el día siguiente (su habilidad falla).',
    summary: 'Saboteador principal del mal que corrompe la información y las habilidades del bien.'
  },
  {
    id: 'spy',
    name: 'Espía',
    originalName: 'Spy',
    team: 'minion',
    edition: 'trouble-brewing',
    ability: 'Cada noche, ves el Grimorio completo. Podrías registrar como Bueno o como Aldeano/Forastero.',
    summary: 'Posee omnisciencia sobre los roles verdaderos y puede engañar las habilidades divinas del bien.'
  },
  {
    id: 'scarlet-woman',
    name: 'Mujer Escarlata',
    originalName: 'Scarlet Woman',
    team: 'minion',
    edition: 'trouble-brewing',
    ability: 'Si hay 5 o más jugadores vivos y el Demonio muere, te conviertes en el nuevo Demonio.',
    summary: 'Red de seguridad para el bando malvado que hereda el liderazgo si el Demonio cae temprano.'
  },
  {
    id: 'baron',
    name: 'Barón',
    originalName: 'Baron',
    team: 'minion',
    edition: 'trouble-brewing',
    ability: 'En la configuración de la partida, añade +2 Forasteros reemplazando a 2 Aldeanos.',
    summary: 'Modifica la estructura de la partida debilitando las habilidades de la comunidad.'
  },

  // --- Demons ---
  {
    id: 'imp',
    name: 'Imp',
    originalName: 'Imp',
    team: 'demon',
    edition: 'trouble-brewing',
    ability: 'Cada noche*, elige un jugador: muere. Si te eliges a ti mismo, mueres y un Esbirro se convierte en el Imp.',
    summary: 'El demonio clásico con la temible capacidad de suicidarse para pasar el rol a un esbirro indetectable.'
  },


  // ==========================================
  // BAD MOON RISING
  // ==========================================

  // --- Townsfolk ---
  {
    id: 'grandmother',
    name: 'Abuela',
    originalName: 'Grandmother',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Empiezas sabiendo un buen jugador y su rol exacto. Si el Demonio lo mata de noche, tú también mueres.',
    summary: 'Vínculo protector protector cuyo nieto es su mayor bendición y riesgo.'
  },
  {
    id: 'sailor',
    name: 'Marinero',
    originalName: 'Sailor',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Cada noche, elige un jugador vivo: uno de vosotros dos se emborracha. Eres inmune a la muerte esa noche/día.',
    summary: 'Tan borracho que resulta inmune a la muerte mientras comparte su trago.'
  },
  {
    id: 'chambermaid',
    name: 'Camarera',
    originalName: 'Chambermaid',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Cada noche, elige 2 jugadores vivos: sabes cuántos de ellos se despertaron esa noche por su propia habilidad.',
    summary: 'Vigilante de la actividad nocturna en las habitaciones del pueblo.'
  },
  {
    id: 'exorcist',
    name: 'Exorcista',
    originalName: 'Exorcist',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Cada noche*, elige un jugador: si es el Demonio, este se entera y no puede elegir víctimas esa noche.',
    summary: 'Bloquea los ataques del Demonio cuando logra señalarlo en las sombras.'
  },
  {
    id: 'innkeeper',
    name: 'Posadero',
    originalName: 'Innkeeper',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Cada noche*, elige 2 jugadores: están protegidos del Demonio, pero uno de ellos se emborracha esa noche.',
    summary: 'Ofrece refugio nocturno a costa de emborrachar a uno de los huéspedes.'
  },
  {
    id: 'gambler',
    name: 'Apostador',
    originalName: 'Gambler',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Cada noche*, elige un jugador y adivina su rol exacto: si te equivocas, mueres esa noche.',
    summary: 'Arriesga su vida en cada apuesta nocturna para desentrañar identidades.'
  },
  {
    id: 'gossip',
    name: 'Chismoso',
    originalName: 'Gossip',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Cada día, puedes hacer una afirmación pública. Si es verdadera, un jugador muere de noche.',
    summary: 'Provoca muertes adicionales si dice verdades públicas sobre la partida.'
  },
  {
    id: 'courtier',
    name: 'Cortesano',
    originalName: 'Courtier',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Una vez por partida, de noche, elige un rol: si está en juego, se emborracha durante 3 noches y 3 días.',
    summary: 'Inhabilita un rol sospechoso durante 3 días completos.'
  },
  {
    id: 'professor',
    name: 'Profesor',
    originalName: 'Professor',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Una vez por partida, de noche*, elige un jugador muerto: si es un Aldeano, resucita.',
    summary: 'Gran erudito capaz de traer de vuelta a los muertos a la vida.'
  },
  {
    id: 'minstrel',
    name: 'Trovador',
    originalName: 'Minstrel',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Cuando un Esbirro es ejecutado, todos los demás jugadores se emborrachan hasta mañana al anochecer.',
    summary: 'Celébrase el ajusticiamiento de un esbirro con una fiesta que emborracha al pueblo.'
  },
  {
    id: 'tea-lady',
    name: 'Dama del Té',
    originalName: 'Tea Lady',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Si tus 2 vecinos vivos son buenos, no pueden morir.',
    summary: 'Crea una zona inexpugnable de protección si está flanqueada por la inocencia.'
  },
  {
    id: 'pacifist',
    name: 'Pacifista',
    originalName: 'Pacifist',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'Un jugador ejecutado del bando bueno podría no morir.',
    summary: 'Su aura pacifista puede salvar a un inocente condenado a la horca.'
  },
  {
    id: 'fool',
    name: 'Bufón',
    originalName: 'Fool',
    team: 'townsfolk',
    edition: 'bad-moon-rising',
    ability: 'La primera vez que mueres, no mueres.',
    summary: 'Posee una segunda oportunidad ante cualquier causa de muerte.'
  },

  // --- Outsiders ---
  {
    id: 'goon',
    name: 'Matón',
    originalName: 'Goon',
    team: 'outsider',
    edition: 'bad-moon-rising',
    ability: 'Cada noche, el primer jugador que te elige con su habilidad se emborracha y tú cambias a su bando.',
    summary: 'Mercenario voluble que se vende al primer jugador que se cruce en su camino.'
  },
  {
    id: 'lunatic',
    name: 'Lunático',
    originalName: 'Lunatic',
    team: 'outsider',
    edition: 'bad-moon-rising',
    ability: 'Crees que eres el Demonio. El verdadero Demonio sabe quién eres y a quién eliges de noche.',
    summary: 'Trágico engañado que realiza elecciones falsas mientras el verdadero Demonio lo observa.'
  },
  {
    id: 'tinker',
    name: 'Hojalatero',
    originalName: 'Tinker',
    team: 'outsider',
    edition: 'bad-moon-rising',
    ability: 'Podrías morir en cualquier momento.',
    summary: 'Inestable e impredecible; puede perecer espontáneamente a capricho del Narrador.'
  },
  {
    id: 'moonchild',
    name: 'Hijo de la Luna',
    originalName: 'Moonchild',
    team: 'outsider',
    edition: 'bad-moon-rising',
    ability: 'Cuando te enteras de que has muerto, elige un jugador vivo: si es bueno, muere esta noche.',
    summary: 'Maldición póstuma que puede cobrarse una víctima inocente al caer.'
  },

  // --- Minions ---
  {
    id: 'godfather',
    name: 'Padrino',
    originalName: 'Godfather',
    team: 'minion',
    edition: 'bad-moon-rising',
    ability: 'Empiezas sabiendo qué Forasteros están en juego. Si un Forastero muere de día, eliges a alguien para matar de noche.',
    summary: 'Líder del crimen que ejecuta venganzas nocturnas tras la muerte de un forastero.'
  },
  {
    id: 'devils-advocate',
    name: 'Abogado del Diablo',
    originalName: 'Devil\'s Advocate',
    team: 'minion',
    edition: 'bad-moon-rising',
    ability: 'Cada noche, elige un jugador vivo: no puede ser ejecutado mañana.',
    summary: 'Defensor legal del mal que vuelve a un cómplice o al demonio inmune a la guillotina.'
  },
  {
    id: 'assassin',
    name: 'Asesino',
    originalName: 'Assassin',
    team: 'minion',
    edition: 'bad-moon-rising',
    ability: 'Una vez por partida, de noche*, elige un jugador: muere, ignorando cualquier protección o inmunidad.',
    summary: 'Ejecutor letal cuyo ataque trasciende protecciones mágicas y divinas.'
  },
  {
    id: 'witch',
    name: 'Bruja',
    originalName: 'Witch',
    team: 'minion',
    edition: 'bad-moon-rising',
    ability: 'Cada noche, elige un jugador: si ese jugador nomina mañana de día, muere inmediatamente.',
    summary: 'Maldice a sospechosos bloqueando sus ganas de acusar en público.'
  },

  // --- Demons ---
  {
    id: 'zombuul',
    name: 'Zombuul',
    originalName: 'Zombuul',
    team: 'demon',
    edition: 'bad-moon-rising',
    ability: 'Cada noche*, si nadie ha muerto hoy de día, elige un jugador: muere. La primera vez que mueres, pareces muerto pero vives.',
    summary: 'Demonio cadáver que resucita en las sombras si el pueblo no vuelve a rematarlo.'
  },
  {
    id: 'pukka',
    name: 'Pukka',
    originalName: 'Pukka',
    team: 'demon',
    edition: 'bad-moon-rising',
    ability: 'Cada noche, elige un jugador: se envenena. El jugador envenenado la noche anterior muere hoy.',
    summary: 'Demonio de veneno lento que consume a sus víctimas con una noche de retraso.'
  },
  {
    id: 'shabaloth',
    name: 'Shabaloth',
    originalName: 'Shabaloth',
    team: 'demon',
    edition: 'bad-moon-rising',
    ability: 'Cada noche*, elige 2 jugadores: mueren. Un jugador devorado anteriormente puede ser regurgitado vivo.',
    summary: 'Monstruo voraz que devora 2 víctimas por noche y a veces las devuelve con vida.'
  },
  {
    id: 'po',
    name: 'Po',
    originalName: 'Po',
    team: 'demon',
    edition: 'bad-moon-rising',
    ability: 'Cada noche*, elige 1 jugador: muere. Si la noche anterior no elegiste a nadie, esta noche eliges a 3.',
    summary: 'Demonio acumulativo que puede guardar sus fuerzas para una masacre nocturna triple.'
  },


  // ==========================================
  // SECTS & VIOLETS
  // ==========================================

  // --- Townsfolk ---
  {
    id: 'clockmaker',
    name: 'Relojero',
    originalName: 'Clockmaker',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Empiezas sabiendo a cuántos pasos de distancia se encuentra el Demonio del Esbirro más cercano.',
    summary: 'Proporciona la distancia exacta en el círculo entre los líderes del mal.'
  },
  {
    id: 'dreamer',
    name: 'Soñador',
    originalName: 'Dreamer',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Cada noche, elige un jugador (no a ti ni al viajero): ves 1 buen rol y 1 rol malvado (uno es el verdadero).',
    summary: 'Visionario que acota la verdad revelando dos opciones de roles para su objetivo.'
  },
  {
    id: 'snake-charmer',
    name: 'Encantador de Serpientes',
    originalName: 'Snake Charmer',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Cada noche, elige un jugador: si es el Demonio, cambiáis de rol y bando, y el antiguo Demonio se envenena.',
    summary: 'Rol arriesgado que puede usurpar la corona del demonio y pasarse al mal.'
  },
  {
    id: 'mathematician',
    name: 'Matemático',
    originalName: 'Mathematician',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Cada noche, sabes cuántos jugadores han recibido información falsa desde el amanecer anterior.',
    summary: 'Contador de anomalías que detecta borracheras, venenos y mentiras en el pueblo.'
  },
  {
    id: 'flowergirl',
    name: 'Florista',
    originalName: 'Flowergirl',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, sabes si el Demonio ha votado hoy durante las nominaciones.',
    summary: 'Rastrea la participación del demonio en las votaciones del día anterior.'
  },
  {
    id: 'town-crier',
    name: 'Pregonero',
    originalName: 'Town Crier',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, sabes si algún Esbirro ha nominado hoy.',
    summary: 'Vigila la agresividad de los esbirros en las acusaciones diurnas.'
  },
  {
    id: 'oracle',
    name: 'Oráculo',
    originalName: 'Oracle',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, sabes cuántos jugadores malvados están muertos.',
    summary: 'Leva la cuenta de los enemigos caídos en el cementerio.'
  },
  {
    id: 'savant',
    name: 'Sabio',
    originalName: 'Savant',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Cada día, visita en privado al Narrador: te dará 2 afirmaciones (una verdadera y otra falsa).',
    summary: 'Analista supremo que recibe enigmas binarios directamente del Narrador.'
  },
  {
    id: 'seamstress',
    name: 'Costurera',
    originalName: 'Seamstress',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Una vez por partida, de noche, elige 2 jugadores: sabes si pertenecen al mismo bando.',
    summary: 'Teje comparaciones de alineamiento entre dos ciudadanos.'
  },
  {
    id: 'philosopher',
    name: 'Filósofo',
    originalName: 'Philosopher',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Una vez por partida, de noche, elige un buen rol: obtienes su habilidad. Si estaba en juego, ese jugador se emborracha.',
    summary: 'Adoptador de habilidades que puede clonar o neutralizar roles del bien.'
  },
  {
    id: 'artist',
    name: 'Artista',
    originalName: 'Artist',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Una vez por partida, de día, haz una pregunta de Sí/No en privado al Narrador.',
    summary: 'Pregunta divina directa que puede revelar verdades trascendentales.'
  },
  {
    id: 'juggler',
    name: 'Malabarista',
    originalName: 'Juggler',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'En tu primer día, adivina públicamente hasta 5 roles de jugadores. Esa noche*, sabrás cuántos adivinaste.',
    summary: 'Espectáculo de hipótesis que premia las corazonadas correctas.'
  },
  {
    id: 'sage',
    name: 'Sabio Nocturno',
    originalName: 'Sage',
    team: 'townsfolk',
    edition: 'sects-and-violets',
    ability: 'Si el Demonio te mata de noche, despiertas y sabes que 1 de 2 jugadores es el Demonio.',
    summary: 'Trampa mortal para el demonio que deja acotado a su asesino al morir.'
  },

  // --- Outsiders ---
  {
    id: 'mutant',
    name: 'Mutante',
    originalName: 'Mutant',
    team: 'outsider',
    edition: 'sects-and-violets',
    ability: 'Si estás "Loco" por ser un Forastero o lo admites, el Narrador podría ejecutarte inmediatamente.',
    summary: 'Obligado a fingir que es un Aldeano bajo amenaza de muerte instantánea.'
  },
  {
    id: 'sweetheart',
    name: 'Querido',
    originalName: 'Sweetheart',
    team: 'outsider',
    edition: 'sects-and-violets',
    ability: 'Cuando mueres, un jugador al azar se emborracha para el resto de la partida.',
    summary: 'Su pérdida entristece tanto al pueblo que emborracha permanentemente a un aliado.'
  },
  {
    id: 'barber',
    name: 'Barbero',
    originalName: 'Barber',
    team: 'outsider',
    edition: 'sects-and-violets',
    ability: 'Si mueres, el Demonio puede elegir a 2 jugadores vivos (que no sean él) para intercambiar sus personajes.',
    summary: 'Su muerte permite al Demonio rehacer las identidades del pueblo.'
  },
  {
    id: 'klutz',
    name: 'Torpe',
    originalName: 'Klutz',
    team: 'outsider',
    edition: 'sects-and-violets',
    ability: 'Cuando te enteras de que has muerto, elige un jugador vivo públicamente: si es malvado, tu bando pierde.',
    summary: 'Su último tropiezo puede regalar la partida al bando malvado si señala al enemigo.'
  },

  // --- Minions ---
  {
    id: 'evil-twin',
    name: 'Gemelo Malvado',
    originalName: 'Evil Twin',
    team: 'minion',
    edition: 'sects-and-violets',
    ability: 'Tú y un jugador del bien sabéis quiénes sois y cuál es vuestro rol. El pueblo no puede ganar mientras el Gemelo Bueno siga vivo.',
    summary: 'Duelo de identidad cara a cara donde el pueblo debe discernir cuál es el impostor.'
  },
  {
    id: 'witch-sv',
    name: 'Bruja de Sombras',
    originalName: 'Witch',
    team: 'minion',
    edition: 'sects-and-violets',
    ability: 'Cada noche, elige un jugador: si nomina mañana de día, muere inmediatamente.',
    summary: 'Silencia a los acusadores infundiendo terror al castigo por nominar.'
  },
  {
    id: 'cerenovus',
    name: 'Cerenovus',
    originalName: 'Cerenovus',
    team: 'minion',
    edition: 'sects-and-violets',
    ability: 'Cada noche, elige un jugador y un rol: debe estar "Loco" por ser ese rol mañana o podría ser ejecutado.',
    summary: 'Inculca demencia obligando a un jugador a interpretar convincentemente un rol ajeno.'
  },
  {
    id: 'pit-hag',
    name: 'Bruja del Pozo',
    originalName: 'Pit-Hag',
    team: 'minion',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, elige a un jugador y un rol: se convierte en ese rol. Si crea un nuevo Demonio, el antiguo muere.',
    summary: 'Alquimista malvada capaz de transformar roles y crear nuevos demonios a capricho.'
  },

  // --- Demons ---
  {
    id: 'fang-gu',
    name: 'Fang Gu',
    originalName: 'Fang Gu',
    team: 'demon',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, elige a un jugador: muere. El primer Forastero elegido se convierte en Fang Gu y tú mueres en su lugar.',
    summary: 'Demonio parasitario que salta a un Forastero haciéndolo cambiar de bando de forma sorpresiva.'
  },
  {
    id: 'vigormortis',
    name: 'Vigormortis',
    originalName: 'Vigormortis',
    team: 'demon',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, elige un jugador: muere. Los Esbirros que matas conservan su habilidad y 1 vecino se envenena.',
    summary: 'Demonio nigromante que mantiene vivos los poderes de sus esbirros asesinados.'
  },
  {
    id: 'no-dashii',
    name: 'No Dashii',
    originalName: 'No Dashii',
    team: 'demon',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, elige un jugador: muere. Tus 2 vecinos Aldeanos más cercanos están envenenados.',
    summary: 'Aura tóxica que pudre silenciosamente las mentes de los aldeanos más próximos.'
  },
  {
    id: 'vortox',
    name: 'Vortox',
    originalName: 'Vortox',
    team: 'demon',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, elige un jugador: muere. Toda la información de los Aldeanos es Falsa. Si nadie es ejecutado de día, el Mal gana.',
    summary: 'Inversionista de la realidad que obliga a que toda pista sea falsa y exige sangre diaria.'
  },


  // ==========================================
  // TRAVELLERS (VIAJEROS)
  // Cada viajero va con el guion al que pertenece (wiki oficial: /Travellers).
  // Nombre y habilidad: traducción de Castelgard del catálogo sincronizado con Villacuervos.
  // ==========================================

  // --- Viajeros · Trouble Brewing ---
  {
    id: 'scapegoat',
    name: 'Chivo Expiatorio',
    originalName: 'Scapegoat',
    team: 'traveller',
    edition: 'trouble-brewing',
    ability: 'Si un jugador de tu alineamiento es ejecutado, podrías ser ejecutado en su lugar.',
    summary: 'El Narrador puede ejecutarle en lugar de un aliado de su bando: protege a su equipo cargando con la soga.'
  },
  {
    id: 'gunslinger',
    name: 'Pistolero',
    originalName: 'Gunslinger',
    team: 'traveller',
    edition: 'trouble-brewing',
    ability: 'Cada día, después del recuento de la 1ª votación, puedes elegir a un jugador que haya votado: muere.',
    summary: 'Castiga los votos: tras la primera votación del día puede matar a cualquiera que haya votado.'
  },
  {
    id: 'beggar',
    name: 'Mendigo',
    originalName: 'Beggar',
    team: 'traveller',
    edition: 'trouble-brewing',
    ability: 'Debes usar una ficha de voto para votar. Si un jugador muerto te da la suya, descubres su alineamiento. Estás sobrio y sano.',
    summary: 'Necesita que le cedan fichas de voto para votar, y así descubre el bando de los muertos que le ayudan.'
  },
  {
    id: 'bureaucrat',
    name: 'Burócrata',
    originalName: 'Bureaucrat',
    team: 'traveller',
    edition: 'trouble-brewing',
    ability: 'Cada noche elige a un jugador (no a ti mismo): mañana su voto cuenta como 3 votos.',
    summary: 'Multiplica el peso de un voto: el jugador elegido vota por tres al día siguiente.'
  },
  {
    id: 'thief',
    name: 'Ladrón',
    originalName: 'Thief',
    team: 'traveller',
    edition: 'trouble-brewing',
    ability: 'Cada noche, elige a un jugador (no a ti mismo): mañana su voto cuenta negativo.',
    summary: 'Resta en lugar de sumar: el voto del jugador elegido cuenta en negativo al día siguiente.'
  },

  // --- Viajeros · Bad Moon Rising ---
  {
    id: 'apprentice',
    name: 'Aprendiz',
    originalName: 'Apprentice',
    team: 'traveller',
    edition: 'bad-moon-rising',
    ability: 'En tu 1ª noche, obtienes una habilidad de Aldeano (si eres bueno), o una habilidad de Esbirro (si eres malvado).',
    summary: 'Llega aprendiendo un oficio: gana la habilidad de un Aldeano si es bueno o la de un Esbirro si es malvado.'
  },
  {
    id: 'matron',
    name: 'Institutriz',
    originalName: 'Matron',
    team: 'traveller',
    edition: 'bad-moon-rising',
    ability: 'Cada día, puedes elegir hasta 3 grupos de 2 jugadores para intercambiar asientos. Los jugadores no pueden abandonar sus asientos para hablar en privado.',
    summary: 'Reorganiza el círculo cambiando de sitio a los jugadores y prohíbe las conversaciones privadas fuera de los asientos.'
  },
  {
    id: 'judge',
    name: 'Juez',
    originalName: 'Judge',
    team: 'traveller',
    edition: 'bad-moon-rising',
    ability: 'Una vez por partida, si otro jugador ha nominado, puedes forzar la ejecución actual para que tenga éxito o fracase.',
    summary: 'Una vez por partida decide el resultado de una votación ajena: la ejecución sale adelante o fracasa, voten lo que voten.'
  },
  {
    id: 'bishop',
    name: 'Obispo',
    originalName: 'Bishop',
    team: 'traveller',
    edition: 'bad-moon-rising',
    ability: 'Solo el Narrador puede nominar. Al menos 1 jugador contrario debe ser nominado cada día.',
    summary: 'Quita las nominaciones a los jugadores: solo nomina el Narrador, que cada día debe nominar a alguien del bando contrario.'
  },
  {
    id: 'voudon',
    name: 'Voudon',
    originalName: 'Voudon',
    team: 'traveller',
    edition: 'bad-moon-rising',
    ability: 'Solo tú y los muertos podéis votar. No necesitan una ficha de votación para hacerlo. No se requiere una mayoría del 50%.',
    summary: 'Da el poder a los muertos: solo ellos y el Voudon votan, sin gastar fichas y sin necesidad de mayoría.'
  },

  // --- Viajeros · Sects & Violets ---
  {
    id: 'butcher',
    name: 'Carnicero',
    originalName: 'Butcher',
    team: 'traveller',
    edition: 'sects-and-violets',
    ability: 'Cada día, después de la 1ª ejecución, puedes nominar otra vez.',
    summary: 'Alarga el día: tras la primera ejecución puede volver a nominar.'
  },
  {
    id: 'bone-collector',
    name: 'Coleccionista de Huesos',
    originalName: 'Bone Collector',
    team: 'traveller',
    edition: 'sects-and-violets',
    ability: 'Una vez por partida, por la noche*, elige a un jugador muerto: recupera su habilidad hasta el anochecer.',
    summary: 'Una vez por partida devuelve a un muerto su habilidad hasta el anochecer.'
  },
  {
    id: 'harlot',
    name: 'Meretriz',
    originalName: 'Harlot',
    team: 'traveller',
    edition: 'sects-and-violets',
    ability: 'Cada noche*, elige a un jugador vivo: si está de acuerdo, descubres su personaje, pero ambos podríais morir.',
    summary: 'Pide a un jugador que le revele su personaje; si acepta, el Narrador puede matar a ambos.'
  },
  {
    id: 'barista',
    name: 'Barista',
    originalName: 'Barista',
    team: 'traveller',
    edition: 'sects-and-violets',
    ability: 'Cada noche, hasta el anochecer, 1) un jugador pasa a estar sobrio, sano y obtiene información verdadera, o, 2) su habilidad funciona dos veces. El jugador descubre cuál.',
    summary: 'Cada noche sirve a un jugador: o su información es verdadera y está sobrio, o su habilidad actúa dos veces.'
  },
  {
    id: 'deviant',
    name: 'Pervertido',
    originalName: 'Deviant',
    team: 'traveller',
    edition: 'sects-and-violets',
    ability: 'Si hoy has sido gracioso, no puedes morir exiliado.',
    summary: 'Se salva del exilio con humor: si ha sido gracioso ese día, no puede morir exiliado.'
  },

  // --- Viajeros · Experimentales ---
  {
    id: 'cacklejack',
    name: 'Risistencia',
    originalName: 'Cacklejack',
    team: 'traveller',
    edition: 'experimental',
    ability: 'Cada día elige 1 jugador: un jugador diferente cambia de personaje esta noche.',
    summary: 'Siembra el caos de identidades: cada día elige a un jugador y otro distinto cambia de personaje esa noche.'
  },
  {
    id: 'gangster',
    name: 'Gánster',
    originalName: 'Gangster',
    team: 'traveller',
    edition: 'experimental',
    ability: 'Una vez por día puedes matar a uno de tus vecinos vivos si el otro vecino vivo lo acepta.',
    summary: 'Ajusta cuentas en el día: puede matar a un vecino vivo si su otro vecino vivo está de acuerdo.'
  },
  {
    id: 'gnome',
    name: 'Gnomo',
    originalName: 'Gnome',
    team: 'traveller',
    edition: 'experimental',
    ability: 'Todos los jugadores empiezan conociendo a un jugador de tu alineamiento. Puedes elegir matar a quien le nomine.',
    summary: 'Todos conocen a un amigo de su bando, y el Gnomo puede matar a quien lo nomine.'
  },


  // ==========================================
  // FABLED (FÁBULAS)
  // Personajes del Narrador, fuera de los bandos (wiki oficial: /Fabled).
  // Nombre y habilidad: traducción de Castelgard del catálogo sincronizado con Villacuervos.
  // ==========================================
  {
    id: 'angel',
    name: 'Ángel',
    originalName: 'Angel',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Algo malo podría pasarle a quien sea más responsable de la muerte de un jugador nuevo.',
    summary: 'Protege a los jugadores nuevos: quien más culpa tenga de su muerte puede sufrir las consecuencias.'
  },
  {
    id: 'buddhist',
    name: 'Budista',
    originalName: 'Buddhist',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Durante los primeros 2 minutos de cada día, los jugadores veteranos no pueden hablar.',
    summary: 'Da voz a los nuevos: los veteranos callan los primeros dos minutos de cada día.'
  },
  {
    id: 'doomsayer',
    name: 'Agorero',
    originalName: 'Doomsayer',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Si quedan 4 o más jugadores vivos, cada jugador vivo puede elegir públicamente (una vez por partida) que un jugador de su propio alineamiento muera.',
    summary: 'Acelera las partidas grandes: con 4 o más vivos, cada jugador puede sacrificar una vez a alguien de su bando.'
  },
  {
    id: 'fiddler',
    name: 'Violinista',
    originalName: 'Fiddler',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Una vez por partida, el Demonio elige en secreto a un jugador contrario: todos los jugadores eligen cuál de estos 2 jugadores gana.',
    summary: 'Resuelve la partida en un duelo: el Demonio reta a un rival y todos votan cuál de los dos gana.'
  },
  {
    id: 'hells-librarian',
    name: 'Bibliotecario del Infierno',
    originalName: 'Hell\'s Librarian',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Algo malo podría pasarle a quien hable cuando el Narrador ha pedido silencio.',
    summary: 'Pone orden en la mesa: quien hable cuando el Narrador pide silencio puede pagarlo.'
  },
  {
    id: 'revolutionary',
    name: 'Revolucionario',
    originalName: 'Revolutionary',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Se sabe que 2 jugadores vecinos son del mismo alineamiento. Una vez por partida, uno de ellos es percibido incorrectamente.',
    summary: 'Pensado para quien juega en pareja: dos vecinos son del mismo bando, aunque uno puede registrarse mal una vez.'
  },
  {
    id: 'toymaker',
    name: 'Juguetero',
    originalName: 'Toymaker',
    team: 'fabled',
    edition: 'fabled',
    ability: 'El Demonio puede elegir no atacar y debe hacer esto al menos una vez por partida. Los jugadores malvados reciben información inicial normal.',
    summary: 'Partidas más suaves para principiantes: el Demonio puede no matar alguna noche y los malvados reciben su información inicial.'
  },
  {
    id: 'djinn',
    name: 'Djinn',
    originalName: 'Djinn',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Usa la regla especial del Djinn. Todos los jugadores saben cuál es.',
    summary: 'Avisa de que el guion tiene combinaciones de personajes con reglas especiales, que todos conocen.'
  },
  {
    id: 'duchess',
    name: 'Duquesa',
    originalName: 'Duchess',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Cada día, 3 jugadores pueden elegir visitarte. Por la noche*, cada visitante descubre cuántos visitantes son malvados, pero 1 recibe información falsa.',
    summary: 'Cada día tres jugadores la visitan y por la noche saben cuántos visitantes son malvados, aunque uno recibe información falsa.'
  },
  {
    id: 'fibbin',
    name: 'Fibbin',
    originalName: 'Fibbin',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Una vez por partida, 1 jugador bueno podría recibir información incorrecta.',
    summary: 'Una vez por partida, un jugador bueno puede recibir información incorrecta: útil en guiones con poca desinformación.'
  },
  {
    id: 'sentinel',
    name: 'Centinela',
    originalName: 'Sentinel',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Podría haber 1 Forastero adicional o 1 menos en juego.',
    summary: 'Permite al Narrador poner un Forastero más o uno menos de lo habitual.'
  },
  {
    id: 'spirit-of-ivory',
    name: 'Espíritu de Marfil',
    originalName: 'Spirit of Ivory',
    team: 'fabled',
    edition: 'fabled',
    ability: 'No puede haber más de 1 jugador malvado adicional.',
    summary: 'Pone un límite al mal: no puede haber más de un jugador malvado extra.'
  },
  {
    id: 'deus-ex-fiasco',
    name: 'Deus Ex Fiasco',
    originalName: 'Deus ex Fiasco',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Al menos una vez por partida, el Narrador cometerá un error, lo corregirá y lo admitirá públicamente.',
    summary: 'Reconoce que el Narrador también se equivoca: al menos una vez cometerá un error, lo corregirá y lo admitirá.'
  },
  {
    id: 'ferryman',
    name: 'Barquero',
    originalName: 'Ferryman',
    team: 'fabled',
    edition: 'fabled',
    ability: 'En el último día, todos los jugadores muertos recuperan su voto.',
    summary: 'Da una última oportunidad a los muertos: el día final todos recuperan su ficha de voto.'
  },


  // ==========================================
  // LORIC
  // Personajes del Narrador que añaden giros a la partida (wiki oficial: /Loric).
  // Nombre y habilidad: traducción de Castelgard del catálogo sincronizado con Villacuervos.
  // ==========================================
  {
    id: 'big-wig',
    name: 'Mandamás',
    originalName: 'Big Wig',
    team: 'loric',
    edition: 'loric',
    ability: 'Cada nominado elige 1 jugador: hasta la votación, sólo puede hablar el elegido y está loco de que el nominado es bueno o puede morir.',
    summary: 'Cambia los debates: cada nominado elige a un único portavoz, que debe convencer a la mesa de que el nominado es bueno o arriesgarse a morir.'
  },
  {
    id: 'bootlegger',
    name: 'Contrabandista',
    originalName: 'Bootlegger',
    team: 'loric',
    edition: 'loric',
    ability: 'Este guion tiene personajes o reglas caseras.',
    summary: 'Avisa de que el guion incluye personajes o reglas caseras, que el Narrador explica antes de empezar.'
  },
  {
    id: 'gardener',
    name: 'Jardinero',
    originalName: 'Gardener',
    team: 'loric',
    edition: 'loric',
    ability: 'El Narrador puede asignar 1 o más personajes a jugadores específicos.',
    summary: 'Permite al Narrador elegir qué personaje recibe un jugador concreto, en vez de repartirlos al azar.'
  },
  {
    id: 'god-of-ug',
    name: 'Dios de Ug',
    originalName: 'God of Ug',
    team: 'loric',
    edition: 'loric',
    ability: 'Un gorro Ug. Si tú tener gorro ug, tú hablar un sonido cada vez pero votar doble. Si tú fallar, tú perder gorro Ug.',
    summary: 'Un gorro pasa de mano en mano: quien lo lleva solo puede hablar con sonidos sueltos, pero su voto vale doble.'
  },
  {
    id: 'hindu',
    name: 'Hindú',
    originalName: 'Hindu',
    team: 'loric',
    edition: 'loric',
    ability: 'Los primeros 4 jugadores que mueran se reencarnan en Viajeros del mismo alineamiento.',
    summary: 'Los cuatro primeros muertos se reencarnan al momento como Viajeros de su mismo bando.'
  },
  {
    id: 'knaves',
    name: 'Truhanes',
    originalName: 'Knaves',
    team: 'loric',
    edition: 'loric',
    ability: 'Hay 2 Narradores: uno miente y otro dice la verdad. Una vez por partida, en el crepúsculo, pueden cambiar.',
    summary: 'Dos Narradores dirigen la partida: uno siempre miente y el otro dice la verdad, y pueden intercambiarse una vez.'
  },
  {
    id: 'pope',
    name: 'Papa',
    originalName: 'Pope',
    team: 'loric',
    edition: 'loric',
    ability: 'Hay personajes buenos duplicados en juego. Pueden ser faroles.',
    summary: 'Puede haber personajes buenos repetidos en juego, así que dos jugadores pueden decir la verdad con el mismo personaje.'
  },
  {
    id: 'storm-catcher',
    name: 'Atrapa tormentas',
    originalName: 'Storm Catcher',
    team: 'loric',
    edition: 'loric',
    ability: 'Nombra un personaje bueno. Si está en juego sólo puede morir por ejecución, pero los malos saben quién es.',
    summary: 'Protege a un personaje bueno nombrado: solo puede morir ejecutado, pero el mal sabe quién es.'
  },
  {
    id: 'tor',
    name: 'Tor',
    originalName: 'Tor',
    team: 'loric',
    edition: 'loric',
    ability: 'Los jugadores no saben su personaje o alineamiento. Lo descubren cuando mueren.',
    summary: 'Nadie sabe su personaje ni su bando hasta que muere: la partida se juega a ciegas.'
  },
  {
    id: 'ventriloquist',
    name: 'Ventrílocuo',
    originalName: 'Ventriloquist',
    team: 'loric',
    edition: 'loric',
    ability: 'Si un jugador está loco de ser un personaje nuevo durante su nominación, puede no morir si es ejecutado hoy.',
    summary: 'Premia los faroles: quien finge de forma convincente ser otro personaje durante su nominación puede sobrevivir a la ejecución.'
  },
  {
    id: 'zenomancer',
    name: 'Zenomante',
    originalName: 'Zenomancer',
    team: 'loric',
    edition: 'loric',
    ability: 'Uno o más jugadores tienen una misión. Cuando la completan aprenden información verdadera.',
    summary: 'Da misiones secretas a algunos jugadores; al cumplirlas, reciben información verdadera.'
  },


  // ==========================================
  // EXPERIMENTAL & OTROS
  // ==========================================
  {
    id: 'marionette',
    name: 'Marioneta',
    originalName: 'Marionette',
    team: 'minion',
    edition: 'experimental',
    ability: 'Crees que eres un Aldeano bueno y estás sentado al lado del Demonio. El Demonio sabe quién eres.',
    summary: 'Esbirro inconsciente que sirve de escudo al demonio creyendo ser del bien.'
  },
  {
    id: 'goblin',
    name: 'Goblin',
    originalName: 'Goblin',
    team: 'minion',
    edition: 'experimental',
    ability: 'Si te declaras públicamente como el Goblin y eres ejecutado ese mismo día, tu bando gana.',
    summary: 'Provocador que busca la horca mediante una confesión suicida victoriosa.'
  },
  {
    id: 'boomdandy',
    name: 'Boomdandy',
    originalName: 'Boomdandy',
    team: 'minion',
    edition: 'experimental',
    ability: 'Si eres ejecutado, todos los jugadores excepto el Demonio y 1 Aldeano mueren inmediatamente.',
    summary: 'Bomba de tiempo andante que hace detonar al pueblo entero si se ejecuta.'
  },
  {
    id: 'psychopath',
    name: 'Psicópata',
    originalName: 'Psychopath',
    team: 'minion',
    edition: 'experimental',
    ability: 'Cada día antes de las votaciones, puedes retar a un jugador a piedra-papel-tijeras: si pierde, muere.',
    summary: 'Asesino impulsivo diurno que reta a duelos fatales en medio de la plaza.'
  },
  {
    id: 'al-hadikhah',
    name: 'Al-Hadikhah',
    originalName: 'Al-Hadikhah',
    team: 'demon',
    edition: 'experimental',
    ability: 'Cada noche*, elige 3 jugadores: deben decidir en secreto si viven o mueren. Si todos viven, todos mueren.',
    summary: 'Demonio del dilema moral que exige sacrificios coordinados a sus víctimas.'
  },
  {
    id: 'legion',
    name: 'Legión',
    originalName: 'Legion',
    team: 'demon',
    edition: 'experimental',
    ability: 'La mayoría de los jugadores son la Legión. Registran como Malvados y como el Demonio.',
    summary: 'Enjambre demoníaco donde la casi totalidad del pueblo pertenece al mal.'
  },
  {
    id: 'amnesiac',
    name: 'Amnésico',
    originalName: 'Amnesiac',
    team: 'townsfolk',
    edition: 'experimental',
    ability: 'Tienes una habilidad única diseñada por el Narrador. Cada día visitas al Narrador para adivinar cuál es tu habilidad.',
    summary: 'Enigma viviente cuyo rol es un misterio a resolver día a día.'
  },
  {
    id: 'pixie',
    name: 'Pixie',
    originalName: 'Pixie',
    team: 'townsfolk',
    edition: 'experimental',
    ability: 'Empiezas sabiendo un Aldeano en juego. Si juegas estando loco por ser ese rol y muere, obtienes su habilidad.',
    summary: 'Espíritu imitador que hereda poderes al seguir el legado de su mentor.'
  }
];
