export const dictionaries = {
  es: {
    title:'Diciembre contigo', intro:'Veinticuatro días para ir abriendo algo bonito, poquito a poco.',
    enter:'Abrir el calendario', code:'Código de acceso', login:'Entrar', logout:'Cerrar sesión',
    invalid:'Ese código no coincide. ¿Lo pruebas otra vez?', limited:'Has hecho demasiados intentos. Vuelve en unos minutos.',
    calendar:'Tu calendario de Adviento', back:'Volver al calendario', day:'Día', locked:'Cerrado',
    opens:'Esta puerta se abre el', next:'La próxima puerta se abre en', all:'Ya puedes abrir las 24 puertas.',
    units:['d','h','min','s'], special:'Día especial', finale:'Navidad', missing:'No encontramos esa puerta.',
    error:'Ahora mismo no se puede abrir el calendario. Inténtalo en un rato.', photo:'Imagen del día',
    demo:'Calendario de muestra', soon:'Cada puerta se abre a medianoche.', welcome:'Adviento'
  }
};
export const translate = language => dictionaries[language] || dictionaries[language?.split('-')[0]] || dictionaries.es;
