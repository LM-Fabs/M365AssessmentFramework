import { useState, useCallback } from 'react';
import { AdminConsentService, FeatureAnalysis, PermissionUpdateResult } from '../services/adminConsentService';

/**
 * React hook for managing app registration permissions with least privilege approach
 * Provides frontend integration for feature-based permission management
 */
export const usePermissionManagement = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPermissions, setCurrentPermissions] = useState<string[]>([]);
  const [featureAnalysis, setFeatureAnalysis] = useState<FeatureAnalysis | null>(null);

  const consentService = AdminConsentService.getInstance();

  /**
   * Get available feature groups with their descriptions
   */
  const getAvailableFeatures = useCallback(() => {
    return AdminConsentService.FEATURE_PERMISSION_GROUPS;
  }, []);

  /**
   * Load current permissions and analyze enabled features
   */
  const loadCurrentPermissions = useCallback(async (clientId: string, accessToken: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await consentService.getCurrentAppPermissions(clientId, accessToken);
      
      if (result.success && result.permissions) {
        setCurrentPermissions(result.permissions);
        const analysis = consentService.analyzeEnabledFeatures(result.permissions);
        setFeatureAnalysis(analysis);
      } else {
        setError(result.error || 'Failed to load permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [consentService]);

  /**
   * Update app registration with selected feature groups
   */
  const updatePermissions = useCallback(async (
    clientId: string,
    accessToken: string,
    selectedFeatures: string[],
    additionalPermissions: string[] = []
  ): Promise<PermissionUpdateResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await consentService.updateAppRegistrationPermissions(
        clientId,
        accessToken,
        {
          featureGroups: selectedFeatures,
          additionalPermissions,
          replaceAll: false // Incremental updates only
        }
      );

      if (result.success) {
        // Reload current permissions to reflect changes
        await loadCurrentPermissions(clientId, accessToken);
      } else {
        setError(result.error || 'Failed to update permissions');
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [consentService, loadCurrentPermissions]);

  /**
   * Generate consent URL for specific features
   */
  const generateConsentUrl = useCallback(async (
    clientId: string,
    redirectUri: string,
    customerId: string,
    selectedFeatures: string[]
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await consentService.generateFeatureBasedConsentUrl(
        clientId,
        redirectUri,
        customerId,
        selectedFeatures
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(error);
      return { url: null, permissions: [], features: [] };
    } finally {
      setLoading(false);
    }
  }, [consentService]);

  /**
   * Get permission summary for UI display
   */
  const getPermissionSummary = useCallback(() => {
    if (!featureAnalysis) return null;

    const features = AdminConsentService.FEATURE_PERMISSION_GROUPS;
    
    return {
      totalFeatures: Object.keys(features).length,
      enabledCount: featureAnalysis.enabledFeatures.length,
      partialCount: featureAnalysis.partialFeatures.length,
      missingCount: featureAnalysis.missingFeatures.length,
      totalPermissions: featureAnalysis.currentPermissions.length,
      enabledFeatures: featureAnalysis.enabledFeatures.map(key => ({
        key,
        name: features[key as keyof typeof features]?.name,
        description: features[key as keyof typeof features]?.description
      })),
      availableFeatures: featureAnalysis.missingFeatures.map(key => ({
        key,
        name: features[key as keyof typeof features]?.name,
        description: features[key as keyof typeof features]?.description,
        permissions: features[key as keyof typeof features]?.permissions
      }))
    };
  }, [featureAnalysis]);

  return {
    // State
    loading,
    error,
    currentPermissions,
    featureAnalysis,
    
    // Actions
    loadCurrentPermissions,
    updatePermissions,
    generateConsentUrl,
    
    // Helpers
    getAvailableFeatures,
    getPermissionSummary,
    
    // Utilities
    clearError: () => setError(null)
  };
};

/**
 * Permission management component props type
 */
export interface PermissionManagerProps {
  clientId: string;
  accessToken: string;
  customerId?: string;
  redirectUri?: string;
  onPermissionUpdate?: (result: PermissionUpdateResult) => void;
  onConsentRequired?: (url: string, features: string[]) => void;
}

/**
 * Feature selection item for UI components
 */
export interface FeatureSelectionItem {
  key: string;
  name: string;
  description: string;
  permissions: readonly string[];
  enabled: boolean;
  partial: boolean;
  required: boolean;
}

/**
 * Utility function to create feature selection items for UI
 */
export const createFeatureSelectionItems = (
  featureAnalysis: FeatureAnalysis | null
): FeatureSelectionItem[] => {
  const features = AdminConsentService.FEATURE_PERMISSION_GROUPS;
  
  return Object.entries(features).map(([key, feature]) => ({
    key,
    name: feature.name,
    description: feature.description,
    permissions: feature.permissions,
    enabled: featureAnalysis?.enabledFeatures.includes(key) || false,
    partial: featureAnalysis?.partialFeatures.includes(key) || false,
    required: feature.required || false
  }));
};
