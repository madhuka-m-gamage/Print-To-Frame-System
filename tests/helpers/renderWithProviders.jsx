import React from 'react';
import { render } from '@testing-library/react';
import { PermissionsProvider, DEFAULT_PERMISSIONS } from '../../src/context/PermissionsContext';

/**
 * Renders `ui` inside PermissionsProvider.
 * - role: returned on the result so tests can pass it to components that take a role prop.
 * - permissions: replaces the settings/permissions document the provider reads.
 * - wrappers: extra providers (e.g. MessagingContext), listed outermost first.
 */
export function renderWithProviders(ui, { role = 'Admin', permissions, wrappers = [], ...renderOptions } = {}) {
  globalThis.__TEST_PERMISSIONS__ = permissions || DEFAULT_PERMISSIONS;

  const Wrapper = ({ children }) => {
    const inner = <PermissionsProvider>{children}</PermissionsProvider>;
    return wrappers.reduceRight((acc, W) => <W>{acc}</W>, inner);
  };

  return { role, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
