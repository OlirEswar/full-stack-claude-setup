describe('config', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = original;
  });

  // Re-evaluate the module in isolation so each test sees its own env.
  function loadApiUrl(): string {
    let value = '';
    jest.isolateModules(() => {
      ({ API_URL: value } = jest.requireActual<typeof import('../src/config')>('../src/config'));
    });
    return value;
  }

  it('API_URL defaults to http://localhost:3000', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(loadApiUrl()).toBe('http://localhost:3000');
  });

  it('API_URL uses EXPO_PUBLIC_API_URL when set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
    expect(loadApiUrl()).toBe('https://api.example.test');
  });
});
