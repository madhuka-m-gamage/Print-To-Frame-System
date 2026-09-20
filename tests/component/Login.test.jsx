import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/services/firebase', () => ({ googleSignIn: vi.fn() }));

const { default: Login } = await import('../../src/components/auth/Login');

describe('Login registration form (Phase 7 5.2, DP-05)', () => {
  it('still registers as a Partner after switching between Login and Register', async () => {
    const onRegister = vi.fn(async () => {});
    render(<Login onLogin={vi.fn()} onRegister={onRegister} errorMsg="" successMsg="" />);

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    const inputs = document.querySelectorAll('form input');
    const byPlaceholder = (re) => [...inputs].find(i => re.test(i.placeholder || ''));
    fireEvent.change(byPlaceholder(/name/i) || inputs[0], { target: { value: 'Nimal' } });
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(onRegister).toHaveBeenCalledTimes(1));
    expect(onRegister.mock.calls[0][0].role).toBe('Partner');
    expect(onRegister.mock.calls[0][0]).toHaveProperty('company', '');
  });
});
