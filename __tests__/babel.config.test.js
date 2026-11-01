const configureBabel = require('../babel.config');

const configFor = env => {
  const previous = {
    BABEL_ENV: process.env.BABEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
    E2E_BUILD: process.env.E2E_BUILD,
    E2E_SKIP_ONBOARDING: process.env.E2E_SKIP_ONBOARDING,
    ENABLE_PALSHUB_INTEGRATION: process.env.ENABLE_PALSHUB_INTEGRATION,
    PLUS_STORE_GATE: process.env.PLUS_STORE_GATE,
  };
  Object.assign(process.env, env);
  for (const key of Object.keys(previous)) {
    if (!(key in env)) {
      delete process.env[key];
    }
  }

  try {
    return configureBabel({
      cache: {using: callback => callback()},
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

const transformDefinitions = config =>
  config.plugins.find(plugin => plugin[0] === 'transform-define')[1];

describe('Babel build constants', () => {
  it('leaves E2E flags runtime-overridable in Jest while selecting the enabled integration lane', () => {
    const config = configFor({BABEL_ENV: 'test'});

    expect(transformDefinitions(config)).toEqual({
      __ENABLE_PALSHUB__: true,
    });
    expect(config.plugins).not.toContainEqual([
      'module:react-native-dotenv',
      {moduleName: '@env'},
    ]);
  });

  it('selects the disabled integration lane explicitly in Jest', () => {
    expect(
      transformDefinitions(
        configFor({
          BABEL_ENV: 'test',
          ENABLE_PALSHUB_INTEGRATION: 'false',
        }),
      ),
    ).toEqual({__ENABLE_PALSHUB__: false});
  });

  it('inlines production E2E and integration flags outside Jest', () => {
    const config = configFor({
      NODE_ENV: 'production',
      E2E_BUILD: 'true',
      E2E_SKIP_ONBOARDING: 'false',
      ENABLE_PALSHUB_INTEGRATION: 'false',
    });

    expect(transformDefinitions(config)).toEqual({
      __E2E__: true,
      __E2E_SKIP_ONBOARDING__: false,
      __ENABLE_PALSHUB__: false,
      __PLUS_STORE_GATE__: true,
    });
    expect(config.plugins).toContainEqual([
      'module:react-native-dotenv',
      {moduleName: '@env'},
    ]);
  });
});

const babelConfig = require('../babel.config');

const ENV_KEYS = [
  'BABEL_ENV',
  'NODE_ENV',
  'E2E_BUILD',
  'E2E_SKIP_ONBOARDING',
  'PLUS_STORE_GATE',
  'ENABLE_PALSHUB_INTEGRATION',
];

let saved;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  ENV_KEYS.forEach(key => delete process.env[key]);
  process.env.BABEL_ENV = 'production';
});

afterEach(() => {
  ENV_KEYS.forEach(key => {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  });
});

function evaluate(env) {
  Object.assign(process.env, env);
  let cacheKey;
  const config = babelConfig({
    cache: {
      using: fn => {
        cacheKey = fn();
        return cacheKey;
      },
    },
  });
  const define = config.plugins.find(
    plugin => Array.isArray(plugin) && plugin[0] === 'transform-define',
  );
  return {cacheKey, defines: define && define[1]};
}

describe('__PLUS_STORE_GATE__', () => {
  it.each([
    [{}, false],
    [{PLUS_STORE_GATE: 'true'}, true],
    [{PLUS_STORE_GATE: '1'}, false],
    [{PLUS_STORE_GATE: 'TRUE'}, false],
    [{PLUS_STORE_GATE: 'yes'}, false],
    [{PLUS_STORE_GATE: 'false'}, false],
    [{E2E_BUILD: 'true'}, true],
    [{E2E_BUILD: 'true', PLUS_STORE_GATE: 'true'}, true],
    [{E2E_BUILD: 'true', PLUS_STORE_GATE: 'false'}, false],
    [{E2E_BUILD: 'true', PLUS_STORE_GATE: '0'}, true],
    [{E2E_BUILD: '1'}, false],
  ])('bundling env %j defines %s', (env, expected) => {
    expect(evaluate(env).defines.__PLUS_STORE_GATE__).toBe(expected);
  });

  it('leaves the other defines unchanged', () => {
    expect(evaluate({PLUS_STORE_GATE: 'true'}).defines).toEqual({
      __E2E__: false,
      __E2E_SKIP_ONBOARDING__: false,
      __PLUS_STORE_GATE__: true,
      __ENABLE_PALSHUB__: false,
    });
  });

  it('is part of the babel cache key', () => {
    const ungated = evaluate({}).cacheKey;
    const gated = evaluate({PLUS_STORE_GATE: 'true'}).cacheKey;
    expect(gated).not.toEqual(ungated);
  });

  it('is not defined under jest, which sets the global instead', () => {
    expect(evaluate({BABEL_ENV: 'test'}).defines).toEqual({
      __ENABLE_PALSHUB__: true,
    });
  });
});
