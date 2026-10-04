import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ path: `${col}/${id}` })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  setDoc: vi.fn(async () => {}),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  serverTimestamp: vi.fn(() => 'ts'),
}));
vi.mock('@/services/firestoreSync', () => ({
  COLLECTIONS: { PARTNERS: 'partners', PARTNER_PUBLIC: 'partner_public', LEADS: 'leads' },
}));

const { default: ReferralForm } = await import('@/features/partners/ReferralForm');
const firestore = await import('firebase/firestore');

const mirror = (data) => firestore.getDoc.mockImplementation(async (ref) =>
  ref.path === 'partner_public/P-1' && data ? { exists: () => true, data: () => data } : { exists: () => false });

const submit = async () => {
  fireEvent.change(screen.getByPlaceholderText('e.g. Kasun Perera'), { target: { name: 'name', value: 'Kasun' } });
  fireEvent.change(screen.getByPlaceholderText('+94 7X XXX XXXX'), { target: { name: 'phone', value: '0771234567' } });
  fireEvent.click(screen.getByRole('button', { name: /Claim 15% Discount/i }));
  await waitFor(() => expect(firestore.setDoc).toHaveBeenCalled());
  return firestore.setDoc.mock.calls[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/referral?ref=P-1');
});

// SEC-6: the anonymous form reads only the public mirror, never the partners collection.
describe('ReferralForm', () => {
  it('reads partner_public/<ref> only and shows an Active partner name', async () => {
    mirror({ name: 'Lanka Art Studio', status: 'Active', logo: '' });
    render(<ReferralForm />);
    expect(await screen.findByText('Lanka Art Studio')).toBeInTheDocument();
    expect(firestore.getDoc).toHaveBeenCalledWith({ path: 'partner_public/P-1' });
    expect(firestore.getDocs).not.toHaveBeenCalled();
    expect(firestore.collection).not.toHaveBeenCalled();
  });

  it('shows the generic name when the mirror is missing', async () => {
    mirror(null);
    render(<ReferralForm />);
    expect(await screen.findByText('Verified Partner Studio')).toBeInTheDocument();
  });

  it('shows the generic name for a non-Active partner, but the lead still records the ref', async () => {
    mirror({ name: 'Closed Studio', status: 'Inactive', logo: '' });
    render(<ReferralForm />);
    expect(await screen.findByText('Verified Partner Studio')).toBeInTheDocument();
    expect(screen.queryByText('Closed Studio')).toBeNull();
    const [ref, lead] = await submit();
    expect(ref.path).toMatch(/^leads\/LD-/);
    expect(lead).toMatchObject({ partnerId: 'P-1', agentId: 'P-1', source: 'Referral', commissionRate: 0 });
  });

  it('writes the referral lead as before with the partner name and commission rate 0', async () => {
    mirror({ name: 'Lanka Art Studio', status: 'Active', logo: '' });
    render(<ReferralForm />);
    await screen.findByText('Lanka Art Studio');
    const [, lead] = await submit();
    expect(lead).toMatchObject({
      name: 'Kasun', source: 'Referral', stage: 'Intake', partnerId: 'P-1', agentId: 'P-1',
      partnerName: 'Lanka Art Studio', agentName: 'Lanka Art Studio', commissionRate: 0, callbackStatus: 'Pending',
    });
  });
});
