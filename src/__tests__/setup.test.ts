import { act } from '@testing-library/react-native';

describe('TRAINR Jest setup', () => {
  it('exports act from React Native Testing Library', () => {
    expect(typeof act).toBe('function');
  });
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('configures the React act environment', () => {
    expect(globalThis.IS_REACT_ACT_ENVIRONMENT).toBe(true);
  });
});