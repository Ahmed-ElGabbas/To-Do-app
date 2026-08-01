import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes one JSON line per call with level, ts, message, context', () => {
    const infoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const logger = new LoggerService();
    logger.setContext('MyContext');

    logger.info('hello', { requestId: 'abc' });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('hello');
    expect(parsed.context).toBe('MyContext');
    expect(parsed.requestId).toBe('abc');
    expect(typeof parsed.ts).toBe('string');
  });

  it('maps warn/error/debug levels', () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);

    new LoggerService().warn('careful');
    new LoggerService().error('boom');
    new LoggerService().debug('trace');

    expect(JSON.parse(warnSpy.mock.calls[0][0]).level).toBe('warn');
    expect(JSON.parse(errorSpy.mock.calls[0][0]).level).toBe('error');
    expect(JSON.parse(logSpy.mock.calls[0][0]).level).toBe('debug');
  });

  it('defaults context when none is set', () => {
    const infoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    new LoggerService().info('x');
    expect(JSON.parse(infoSpy.mock.calls[0][0]).context).toBeUndefined();
  });
});
