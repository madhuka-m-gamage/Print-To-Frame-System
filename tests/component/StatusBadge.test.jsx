import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { StatusBadge } from '@/shared/ui';
import { usePermissions } from '@/context/PermissionsContext';
import { renderWithProviders } from '../helpers/renderWithProviders';

describe('component harness smoke', () => {
  it('renders the status text', () => {
    renderWithProviders(<StatusBadge status="Completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders nothing without a status', () => {
    const { container } = renderWithProviders(<StatusBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes RBAC through the provider', () => {
    const Probe = () => {
      const { canAccess } = usePermissions();
      return <span>{canAccess('Partner', 'invoices') ? 'yes' : 'no'}</span>;
    };
    renderWithProviders(<Probe />, { role: 'Partner' });
    expect(screen.getByText('no')).toBeInTheDocument();
  });
});
