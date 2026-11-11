let mockInitialize;

jest.mock('@usebruno/requests', () => ({
  initializeShellEnv: (...args) => mockInitialize(...args)
}));

describe('shell-env-state', () => {
  let initializeShellEnv, waitForShellEnv, refreshShellEnv, markShellEnvStale, refreshShellEnvIfStale;

  beforeEach(() => {
    jest.resetModules();
    mockInitialize = jest.fn(() => Promise.resolve());
    ({ initializeShellEnv, waitForShellEnv, refreshShellEnv, markShellEnvStale, refreshShellEnvIfStale } = require('../shell-env-state'));
  });

  describe('initializeShellEnv', () => {
    it('calls the underlying initializer exactly once on first call', () => {
      initializeShellEnv();
      initializeShellEnv();
      initializeShellEnv();
      initializeShellEnv();
      initializeShellEnv();
      initializeShellEnv();
      initializeShellEnv();
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('returns undefined (fire-and-forget)', () => {
      const result = initializeShellEnv();
      expect(result).toBeUndefined();
    });
  });

  describe('waitForShellEnv', () => {
    it('returns a promise', () => {
      const result = waitForShellEnv();
      expect(result).toBeInstanceOf(Promise);
    });

    it('resolves when the underlying promise resolves', async () => {
      mockInitialize = jest.fn(() => Promise.resolve('shell-ready'));

      await expect(waitForShellEnv()).resolves.toBe('shell-ready');
    });

    it('returns the same promise on repeated calls', () => {
      const p1 = waitForShellEnv();
      const p2 = waitForShellEnv();
      expect(p1).toBe(p2);
    });

    it('does not reinitialize if initializeShellEnv was already called', () => {
      initializeShellEnv();
      waitForShellEnv();
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('propagates rejection from the underlying initializer', async () => {
      const err = new Error('shell init failed');
      mockInitialize = jest.fn(() => Promise.reject(err));

      await expect(waitForShellEnv()).rejects.toThrow('shell init failed');
    });

    describe('timeout', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('rejects after 60 seconds', async () => {
        mockInitialize = jest.fn(() => new Promise(() => {})); // never resolves
        ({ waitForShellEnv } = require('../shell-env-state'));

        const p = waitForShellEnv();
        jest.advanceTimersByTime(60_000);

        await expect(p).rejects.toThrow('Shell environment initialization timed out');
      });

      it('resets the promise after timeout so next call retries', async () => {
        mockInitialize = jest.fn(() => new Promise(() => {}));
        ({ initializeShellEnv, waitForShellEnv } = require('../shell-env-state'));

        const p = waitForShellEnv();
        jest.advanceTimersByTime(60_000);
        await expect(p).rejects.toThrow('timed out');

        // After timeout _promise is null — next call should reinitialize
        mockInitialize = jest.fn(() => Promise.resolve('retry-ok'));
        const p2 = waitForShellEnv();
        await expect(p2).resolves.toBe('retry-ok');
        expect(mockInitialize).toHaveBeenCalledTimes(1);
      });

      it('does not time out if the initializer resolves in time', async () => {
        mockInitialize = jest.fn(() => Promise.resolve('fast'));
        ({ waitForShellEnv } = require('../shell-env-state'));

        const p = waitForShellEnv();
        jest.advanceTimersByTime(59_999);

        await expect(p).resolves.toBe('fast');
      });
    });
  });

  // A promessa é memoizada de propósito (o boot não pode subir sete shells). O efeito colateral era
  // que NADA voltava a ler o ambiente: token trocado no ~/.zshrc só valia fechando e reabrindo.
  describe('refreshShellEnv', () => {
    it('reads the shell again instead of handing back the memoized result', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1' }));
      ({ waitForShellEnv, refreshShellEnv } = require('../shell-env-state'));

      await waitForShellEnv();
      expect(mockInitialize).toHaveBeenCalledTimes(1);

      await refreshShellEnv();

      expect(mockInitialize).toHaveBeenCalledTimes(2);
    });

    it('reports which variables changed', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1', STABLE: 'same' }));
      ({ waitForShellEnv, refreshShellEnv } = require('../shell-env-state'));
      await waitForShellEnv();

      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v2', STABLE: 'same', NOVA: 'x' }));
      const changed = await refreshShellEnv();

      expect(changed.sort()).toEqual(['NOVA', 'TOKEN']);
    });

    it('reports nothing when the shell config did not actually change', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1' }));
      ({ waitForShellEnv, refreshShellEnv } = require('../shell-env-state'));
      await waitForShellEnv();

      const changed = await refreshShellEnv();

      // Um save que não mexeu em variável nenhuma não pode virar aviso na tela.
      expect(changed).toEqual([]);
    });

    it('propagates failure instead of reporting a phantom change', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1' }));
      ({ waitForShellEnv, refreshShellEnv } = require('../shell-env-state'));
      await waitForShellEnv();

      mockInitialize = jest.fn(() => Promise.reject(new Error('shell died')));

      await expect(refreshShellEnv()).rejects.toThrow('shell died');
    });
  });

  // Ler o ambiente sobe um shell de login — segundos, num perfil que decripta segredos. Por isso a
  // releitura é PREGUIÇOSA: o foco só marca, e quem paga é o momento do uso (abrir um request).
  describe('refreshShellEnvIfStale', () => {
    const carregar = () => ({ markShellEnvStale, refreshShellEnvIfStale, waitForShellEnv }
      = require('../shell-env-state'));

    it('does nothing when the window never regained focus', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1' }));
      carregar();
      await waitForShellEnv();
      expect(mockInitialize).toHaveBeenCalledTimes(1);

      // sem marcar como stale: abrir requests não pode subir um shell a cada clique
      await refreshShellEnvIfStale(0);
      await refreshShellEnvIfStale(0);

      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('re-reads once after focus, and reports what changed', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1' }));
      carregar();
      await waitForShellEnv();

      markShellEnvStale();
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v2' }));
      const changed = await refreshShellEnvIfStale(0);

      expect(changed).toEqual(['TOKEN']);
    });

    it('does not re-read again until the window is focused once more', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1' }));
      carregar();
      await waitForShellEnv();

      markShellEnvStale();
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v2' }));
      await refreshShellEnvIfStale(0);
      expect(mockInitialize).toHaveBeenCalledTimes(1);

      // abrir outro request logo em seguida: o stale já foi consumido, nada de novo shell
      await refreshShellEnvIfStale(0);
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('respects the minimum age, so rapid clicking cannot spawn shells', async () => {
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v1' }));
      carregar();
      await waitForShellEnv();

      markShellEnvStale();
      mockInitialize = jest.fn(() => Promise.resolve({ TOKEN: 'v2' }));
      // leitura recém-feita + idade mínima alta => recusa reler
      const changed = await refreshShellEnvIfStale(60_000);

      expect(changed).toEqual([]);
      expect(mockInitialize).not.toHaveBeenCalled();
    });
  });
});
