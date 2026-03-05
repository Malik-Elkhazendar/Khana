import { MinutesToHoursPipe } from './minutes-to-hours.pipe';

describe('MinutesToHoursPipe', () => {
  let pipe: MinutesToHoursPipe;

  beforeEach(() => {
    pipe = new MinutesToHoursPipe();
  });

  it('formats 0 minutes', () => {
    expect(pipe.transform(0)).toBe('0m');
  });

  it('formats sub-hour minutes', () => {
    expect(pipe.transform(30)).toBe('30m');
  });

  it('formats exact hours', () => {
    expect(pipe.transform(60)).toBe('1h');
    expect(pipe.transform(480)).toBe('8h');
  });

  it('formats mixed hours and minutes', () => {
    expect(pipe.transform(90)).toBe('1h 30m');
    expect(pipe.transform(135)).toBe('2h 15m');
  });

  it('returns defensive fallback for negative minutes', () => {
    expect(pipe.transform(-1)).toBe('0m');
  });
});
