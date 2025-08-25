export type CircuitState = {
  open: boolean;
  failureRate: number; // 0..100
  lastTripAt?: string;
};

let state: CircuitState = { open: false, failureRate: 0 };

export function getCircuitBreakerStatus(): CircuitState {
  return state;
}

export function tripCircuitBreaker(rate: number) {
  state = { open: true, failureRate: rate, lastTripAt: new Date().toISOString() };
}

export function resetCircuitBreaker() {
  state = { open: false, failureRate: 0 };
}
