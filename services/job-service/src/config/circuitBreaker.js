import CircuitBreaker from 'opossum';

export const dbCircuitBreaker = new CircuitBreaker(async (query) => query(), {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  name: 'database'
});

export const esCircuitBreaker = new CircuitBreaker(async (query) => query(), {
  timeout: 2000,
  errorThresholdPercentage: 40,
  resetTimeout: 20000,
  rollingCountTimeout: 10000,
  name: 'elasticsearch'
});
