import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Customer } from '../services/customerService';

interface CustomerContextType {
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  selectedCustomerAssessment: any | null;
  setSelectedCustomerAssessment: (assessment: any | null) => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const useCustomer = () => {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};

interface CustomerProviderProps {
  children: ReactNode;
}

export const CustomerProvider: React.FC<CustomerProviderProps> = ({ children }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerAssessment, setSelectedCustomerAssessment] = useState<any | null>(null);

  return (
    <CustomerContext.Provider 
      value={{
        selectedCustomer,
        setSelectedCustomer,
        selectedCustomerAssessment,
        setSelectedCustomerAssessment
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};
