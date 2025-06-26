import React, { useState, useEffect } from 'react';
import { CustomerService, Customer, CreateCustomerRequest } from '../../services/customerService';
import './CustomerSelector.css';

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
  onCustomerCreate?: (customer: Customer) => void;
  placeholder?: string;
  disabled?: boolean;
  showCreateNew?: boolean;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomer,
  onCustomerSelect,
  onCustomerCreate,
  placeholder = "Select a customer...",
  disabled = false,
  showCreateNew = true
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateCustomerRequest>({
    tenantName: '',
    tenantDomain: '',
    contactEmail: '',
    notes: ''
  });
  const [creating, setCreating] = useState(false);

  const customerService = CustomerService.getInstance();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      console.log('🔄 CustomerSelector: Starting to load customers...');
      setLoading(true);
      setError(null);
      
      const customerList = await customerService.getCustomers();
      console.log('📋 CustomerSelector: Received customer list:', customerList);
      
      const activeCustomers = customerList.filter(c => c.status === 'active');
      console.log('✅ CustomerSelector: Active customers:', activeCustomers);
      
      setCustomers(activeCustomers);
      
      if (customerList.length === 0) {
        console.info('ℹ️ CustomerSelector: No customers found - this is normal for a new deployment');
      } else {
        console.log('🎉 CustomerSelector: Successfully loaded', activeCustomers.length, 'active customers');
      }
    } catch (err) {
      console.error('❌ CustomerSelector: Failed to load customers:', err);
      setError(err instanceof Error ? err.message : 'Unable to load customers. Please check your connection.');
      setCustomers([]); // Clear any existing data
    } finally {
      setLoading(false);
      console.log('🏁 CustomerSelector: Finished loading customers');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.tenantDomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCustomerSelect = (customer: Customer) => {
    onCustomerSelect(customer);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.tenantName || !createFormData.tenantDomain) {
      setError('Tenant name and domain are required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      console.log('🚀 Creating new customer with data:', createFormData);
      
      const newCustomer = await customerService.createCustomer(createFormData);
      console.log('✅ Customer created successfully:', newCustomer);
      
      // Add to customers list immediately to update UI
      setCustomers(prev => {
        const updatedList = [...prev, newCustomer];
        console.log('📋 Updated customer list:', updatedList);
        return updatedList;
      });
      
      // Select the new customer
      onCustomerSelect(newCustomer);
      onCustomerCreate?.(newCustomer);
      
      // Reset form
      setCreateFormData({
        tenantName: '',
        tenantDomain: '',
        contactEmail: '',
        notes: ''
      });
      setShowCreateForm(false);
      setIsDropdownOpen(false);
      
      // Reload customers list to ensure consistency
      setTimeout(() => {
        console.log('🔄 Reloading customers list for consistency...');
        loadCustomers();
      }, 500);
      
    } catch (err) {
      console.error('❌ Failed to create customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setCreating(false);
    }
  };

  const formatLastAssessment = (date?: Date): string => {
    if (!date) return 'No assessments';
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 30) return `${diffInDays} days ago`;
    
    const months = Math.floor(diffInDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  };

  return (
    <div className="customer-selector">
      <div className={`customer-selector-container ${isDropdownOpen ? 'open' : ''}`}>
        <div 
          className={`customer-selector-input ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
        >
          {selectedCustomer ? (
            <div className="selected-customer">
              <div className="customer-main">
                <span className="customer-name">{selectedCustomer.tenantName}</span>
                <span className="customer-domain">{selectedCustomer.tenantDomain}</span>
              </div>
              <div className="customer-meta">
                <span className="assessment-count">{selectedCustomer.totalAssessments} assessments</span>
                <span className="last-assessment">{formatLastAssessment(selectedCustomer.lastAssessmentDate)}</span>
              </div>
            </div>
          ) : (
            <span className="placeholder">{placeholder}</span>
          )}
          
          <svg 
            className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {isDropdownOpen && (
          <div className="customer-dropdown">
            <div className="dropdown-search">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="dropdown-content">
              {loading ? (
                <div className="dropdown-loading">Loading customers...</div>
              ) : error && !showCreateForm ? (
                <div className="dropdown-error">{error}</div>
              ) : (
                <>
                  {filteredCustomers.length > 0 && (
                    <div className="customer-list">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className="customer-option"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          <div className="customer-option-main">
                            <span className="customer-option-name">{customer.tenantName}</span>
                            <span className="customer-option-domain">{customer.tenantDomain}</span>
                          </div>
                          <div className="customer-option-meta">
                            <span className="option-assessment-count">{customer.totalAssessments} assessments</span>
                            <span className="option-last-assessment">{formatLastAssessment(customer.lastAssessmentDate)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredCustomers.length === 0 && searchQuery && (
                    <div className="no-results">
                      No customers found matching "{searchQuery}"
                    </div>
                  )}

                  {showCreateNew && (
                    <>
                      <div className="dropdown-divider" />
                      
                      {!showCreateForm ? (
                        <button
                          className="create-new-button"
                          onClick={() => setShowCreateForm(true)}
                        >
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          Add New Customer
                        </button>
                      ) : (
                        <form className="create-customer-form" onSubmit={handleCreateCustomer}>
                          <h4>Add New Customer</h4>
                          
                          {error && <div className="form-error">{error}</div>}
                          
                          <div className="form-field">
                            <label>Tenant Name *</label>
                            <input
                              type="text"
                              value={createFormData.tenantName}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, tenantName: e.target.value }))}
                              placeholder="e.g., Contoso Ltd"
                              required
                            />
                          </div>
                          
                          <div className="form-field">
                            <label>Tenant Domain *</label>
                            <input
                              type="text"
                              value={createFormData.tenantDomain}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, tenantDomain: e.target.value }))}
                              placeholder="e.g., contoso.onmicrosoft.com"
                              required
                            />
                          </div>
                          
                          <div className="form-field">
                            <label>Contact Email</label>
                            <input
                              type="email"
                              value={createFormData.contactEmail}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                              placeholder="admin@contoso.com"
                            />
                          </div>
                          
                          <div className="form-actions">
                            <button
                              type="button"
                              className="cancel-button"
                              onClick={() => {
                                setShowCreateForm(false);
                                setError(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="submit-button"
                              disabled={creating}
                            >
                              {creating ? 'Creating...' : 'Create Customer'}
                            </button>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div className="selected-customer-info">
          <small>
            App Registration: {selectedCustomer.applicationId} | 
            Last Assessment: {formatLastAssessment(selectedCustomer.lastAssessmentDate)}
          </small>
        </div>
      )}
    </div>
  );
};

export default CustomerSelector;