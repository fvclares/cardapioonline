/**
 * Serviço de Identificação e Gestão de Clientes e Endereços
 * Compatível com file:// e http://
 */

const customerService = {
  // Retorna o perfil atual do cliente
  getProfile() {
    let profile = window.storage?.getCustomerProfile();
    if (!profile) {
      profile = {
        token: window.storage?.getCustomerToken() || 'cust_guest',
        name: '',
        phone: '',
        addresses: [],
        default_address_id: null
      };
    }
    return profile;
  },

  // Salva ou atualiza os dados básicos do cliente
  saveProfile(name, phone) {
    const profile = this.getProfile();
    profile.name = name.trim();
    profile.phone = this.cleanPhone(phone);
    return window.storage.saveCustomerProfile(profile);
  },

  // Adiciona ou atualiza um endereço salvo
  saveAddress(addressData) {
    const profile = this.getProfile();
    if (!profile.addresses) profile.addresses = [];

    const addressId = addressData.id || 'addr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const newAddress = {
      id: addressId,
      label: addressData.label || 'Casa',
      street: addressData.street.trim(),
      number: addressData.number.trim(),
      complement: (addressData.complement || '').trim(),
      neighborhood: addressData.neighborhood.trim(),
      city: addressData.city || 'São Paulo',
      reference: (addressData.reference || '').trim()
    };

    const existingIndex = profile.addresses.findIndex(a => a.id === addressId);
    if (existingIndex >= 0) {
      profile.addresses[existingIndex] = newAddress;
    } else {
      profile.addresses.push(newAddress);
      if (profile.addresses.length === 1) {
        profile.default_address_id = addressId;
      }
    }

    window.storage.saveCustomerProfile(profile);
    return newAddress;
  },

  // Remove um endereço
  removeAddress(addressId) {
    const profile = this.getProfile();
    if (!profile.addresses) return;
    profile.addresses = profile.addresses.filter(a => a.id !== addressId);
    if (profile.default_address_id === addressId) {
      profile.default_address_id = profile.addresses[0]?.id || null;
    }
    window.storage.saveCustomerProfile(profile);
  },

  // Define endereço padrão
  setDefaultAddress(addressId) {
    const profile = this.getProfile();
    profile.default_address_id = addressId;
    window.storage.saveCustomerProfile(profile);
  },

  // Formata telefone visualmente: (11) 99999-9999
  formatPhone(value) {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').substring(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
    if (digits.length <= 10) return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
  },

  // Limpa caracteres especiais do telefone
  cleanPhone(value) {
    if (!value) return '';
    return value.replace(/\D/g, '');
  },

  // Formata moeda brasileira R$ 00,00
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
  }
};

window.customerService = customerService;

// ES Module export
export { customerService };
