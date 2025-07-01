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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const customerService = CustomerService.getInstance();

  useEffect(() => {
    loadCustomers();
  }, [refreshTrigger]); // Add refreshTrigger as dependency

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const customerList = await customerService.getCustomers();
      const activeCustomers = customerList.filter(c => c.status === 'active');
      setCustomers(activeCustomers);
      
      if (customerList.length === 0) {
        console.info('No customers found - this is normal for a new deployment');
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(err instanceof Error ? err.message : 'Unable to load customers. Please check your connection.');
      setCustomers([]); // Clear any existing data
    } finally {
      setLoading(false);
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
      
      const newCustomer = await customerService.createCustomer(createFormData);
      
      // Add to customers list immediately to update UI
      setCustomers(prev => [...prev, newCustomer]);
      
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
        loadCustomers();
      }, 500);
      
    } catch (err) {
      console.error('Failed to create customer:', err);
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

  // Add a public method to refresh the customer list
  const refreshCustomerList = () => {
    console.log('🔄 CustomerSelector: Manual refresh requested');
    setRefreshTrigger(prev => prev + 1);
  };

  // Expose refresh method to parent components via onCustomerCreate callback
  useEffect(() => {
    if (onCustomerCreate && typeof onCustomerCreate === 'function') {
      // Monkey patch to add refresh capability
      (onCustomerCreate as any).refresh = refreshCustomerList;
    }
  }, [onCustomerCreate]);

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

                  {filteredCustomers.length === 0 && !searchQuery && !loading && (
                    <div className="no-customers">
                      <p>No customers available.</p>
                      <small>Customers need to be created through the Settings page.</small>
                    </div>
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