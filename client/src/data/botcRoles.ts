export interface Character {
  id: string;
  name: string;
  originalName: string;
  team: 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveller' | 'fabled';
  edition: 'trouble-brewing' | 'bad-moon-rising' | 'sects-and-violets' | 'experimental' | 'traveller' | 'fabled';
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
  // ==========================================
  {
    id: 'scapegoat',
    name: 'Chivo Expiatorio',
    originalName: 'Scapegoat',
    team: 'traveller',
    edition: 'traveller',
    ability: 'Si un jugador de tu bando es ejecutado, puedes decidir morir en su lugar.',
    summary: 'Mártir que asume el castigo de la soga para salvar a un aliado.'
  },
  {
    id: 'beggar',
    name: 'Mendigo',
    originalName: 'Beggar',
    team: 'traveller',
    edition: 'traveller',
    ability: 'No tienes voto. Solo puedes votar si un jugador vivo te concede su ficha de voto.',
    summary: 'Pide caridad democrática a los conciudadanos para intervenir en las ejecuciones.'
  },
  {
    id: 'bureaucrat',
    name: 'Burocrata',
    originalName: 'Bureaucrat',
    team: 'traveller',
    edition: 'traveller',
    ability: 'Cada noche, elige un jugador: su voto mañana vale por 3 votos.',
    summary: 'Concede un peso político aplastante al voto del ciudadano elegido.'
  },
  {
    id: 'thief',
    name: 'Ladrón',
    originalName: 'Thief',
    team: 'traveller',
    edition: 'traveller',
    ability: 'Cada noche, elige un jugador: su voto mañana vale por -1 voto.',
    summary: 'Resta fuerza democrática al sospechoso o enemigo designado.'
  },
  {
    id: 'gunslinger',
    name: 'Pistolero',
    originalName: 'Gunslinger',
    team: 'traveller',
    edition: 'traveller',
    ability: 'Cada día, tras la primera votación, elige a un jugador que haya votado: ese jugador muere.',
    summary: 'Justiciero nocturno que ajusticia de inmediato a quienes alcen la mano en votaciones.'
  },
  {
    id: 'judge',
    name: 'Juez',
    originalName: 'Judge',
    team: 'traveller',
    edition: 'traveller',
    ability: 'Una vez por partida, si te parece justa una votación, puedes forzar que la ejecución se cumpla o se anule inmediatamente.',
    summary: 'Autoridad suprema de la corte con poder de veto de ejecución.'
  },


  // ==========================================
  // FABLED (LEGENDARIOS)
  // ==========================================
  {
    id: 'doomsayer',
    name: 'Agorero',
    originalName: 'Doomsayer',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Si 4 o más jugadores están vivos, cualquier jugador puede reclamar el poder del Agorero para matar a un sospechoso, pero su propio bando sufre penalización.',
    summary: 'Habilidad legendaria global que permite sacrificios extremos por justicia.'
  },
  {
    id: 'angel',
    name: 'Ángel',
    originalName: 'Angel',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Protege a los jugadores novatos de ser acosados o eliminados prematuramente por el grupo.',
    summary: 'Guardia espiritual que vela por la buena convivencia y la curva de aprendizaje de los iniciados.'
  },
  {
    id: 'duchess',
    name: 'Duquesa',
    originalName: 'Duchess',
    team: 'fabled',
    edition: 'fabled',
    ability: 'Cada día, 3 jugadores pueden visitar a la Duquesa para saber si entre ellos hay alguien del mal.',
    summary: 'Anfitriona noble que concede oráculos a grupos de visitantes.'
  },
  {
    id: 'sentinel',
    name: 'Centinela',
    originalName: 'Sentinel',
    team: 'fabled',
    edition: 'fabled',
    ability: 'En el setup, puede haber +1 o -1 Forasteros respecto al número estándar.',
    summary: 'Altera impredeciblemente la cuenta de Forasteros en la partida.'
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
