interface Tenant {
    tenantId: string;
    name: string;
    createdDate: Date;
    status: 'Active' | 'Inactive' | 'Suspended';
}

export type { Tenant };