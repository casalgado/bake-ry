const { parseSpanishName } = require('../../utils/helpers');

describe('helpers', () => {
  describe('parseSpanishName', () => {
    it('should keep B2B names as typed, only collapsing spaces', () => {
      const result = parseSpanishName('  Panadería   La  Espiga S.A.S. ', 'B2B');
      expect(result).toEqual({ firstName: 'Panadería La Espiga S.A.S.', lastName: '', name: 'Panadería La Espiga S.A.S.' });
    });

    it('should split a two-word name starting with a compound first name', () => {
      const result = parseSpanishName('juan pérez');
      expect(result).toEqual({ firstName: 'Juan', lastName: 'Pérez', name: 'Juan Pérez' });
    });

    it('should keep compound first names together', () => {
      const result = parseSpanishName('José Luis Gómez');
      expect(result).toEqual({ firstName: 'José Luis', lastName: 'Gómez', name: 'José Luis Gómez' });
    });

    it('should match compound first names typed without accents', () => {
      const result = parseSpanishName('jose luis gomez');
      expect(result).toEqual({ firstName: 'Jose Luis', lastName: 'Gomez', name: 'Jose Luis Gomez' });
    });

    it('should keep "maria del" names together, with or without accents', () => {
      expect(parseSpanishName('maria del carmen lópez').firstName).toBe('Maria del Carmen');
      expect(parseSpanishName('María del Carmen López').firstName).toBe('María del Carmen');
    });

    it('should return empty names for empty input', () => {
      expect(parseSpanishName('')).toEqual({ firstName: '', lastName: '', type: 'unknown' });
    });
  });
});
