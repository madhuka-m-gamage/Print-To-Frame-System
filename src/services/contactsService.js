/**
 * Google Contacts People API Integration Service
 */
import { getScopedAccessToken } from './firebase';

const CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';

export async function fetchGoogleContacts() {
  const token = await getScopedAccessToken(CONTACTS_SCOPE);

  try {
    const response = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Google People API error: ${response.statusText}`);
    }

    const data = await response.json();
    const connections = data.connections || [];

    return connections.map(person => ({
      resourceName: person.resourceName,
      name: person.names?.[0]?.displayName || 'Unnamed Contact',
      email: person.emailAddresses?.[0]?.value || '',
      phone: person.phoneNumbers?.[0]?.value || '',
      company: person.organizations?.[0]?.name || '',
      whatsapp: person.phoneNumbers?.[0]?.value || '', // Synchronized WhatsApp handle
    }));
  } catch (error) {
    console.error('Failed to fetch Google Contacts:', error);
    throw error;
  }
}
