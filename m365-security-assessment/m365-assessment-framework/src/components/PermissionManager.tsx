import React, { useState, useEffect } from 'react';
import { usePermissionManagement, createFeatureSelectionItems, FeatureSelectionItem } from '../hooks/usePermissionManagement';
import { M365_ASSESSMENT_CONFIG } from '../services/adminConsentService';

/**
 * Permission Management Component
 * Demonstrates least privilege approach with feature-based permission selection
 */
export const PermissionManager: React.FC = () => {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['core']); // Always include core
  const [accessToken, setAccessToken] = useState<string>(''); // You'll need to get this from your auth flow
  const [featureItems, setFeatureItems] = useState<FeatureSelectionItem[]>([]);
  
  const {
    loading,
    error,
    featureAnalysis,
    loadCurrentPermissions,
    updatePermissions,
    generateConsentUrl,
    getPermissionSummary,
    clearError
  } = usePermissionManagement();

  // Load current permissions on mount
  useEffect(() => {
    if (accessToken) {
      loadCurrentPermissions(M365_ASSESSMENT_CONFIG.clientId, accessToken);
    }
  }, [accessToken, loadCurrentPermissions]);

  // Update feature selection items when analysis changes
  useEffect(() => {
    const items = createFeatureSelectionItems(featureAnalysis);
    setFeatureItems(items);
  }, [featureAnalysis]);

  const handleFeatureToggle = (featureKey: string) => {
    if (featureKey === 'core') return; // Core is always required
    
    setSelectedFeatures(prev => 
      prev.includes(featureKey)
        ? prev.filter(f => f !== featureKey)
        : [...prev, featureKey]
    );
  };

  const handleUpdatePermissions = async () => {
    if (!accessToken) {
      alert('Access token required');
      return;
    }

    const result = await updatePermissions(
      M365_ASSESSMENT_CONFIG.clientId,
      accessToken,
      selectedFeatures
    );

    if (result.success) {
      alert(`✅ Permissions updated successfully!\n\nNew permissions: ${result.newPermissions?.length || 0}\nAdmin consent required: ${result.consentsRequired ? 'Yes' : 'No'}`);
      
      if (result.consentsRequired) {
        // Generate consent URL for the updated permissions
        const consentResult = await generateConsentUrl(
          M365_ASSESSMENT_CONFIG.clientId,
          M365_ASSESSMENT_CONFIG.defaultRedirectUri,
          'your-customer-id', // Replace with actual customer ID
          selectedFeatures
        );
        
        if (consentResult.url) {
          window.open(consentResult.url, '_blank');
        }
      }
    } else {
      alert(`❌ Error: ${result.error}`);
    }
  };

  const permissionSummary = getPermissionSummary();

  return (
    <div className="permission-manager p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">🔐 Permission Management</h2>
      
      {/* Access Token Input - Replace with your auth integration */}
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Access Token Required</h3>
        <p className="text-sm text-yellow-700 mb-3">
          Enter an access token with Application.ReadWrite.All permission to manage app registration permissions.
        </p>
        <input
          type="password"
          placeholder="Enter access token..."
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-red-800">❌ {error}</span>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Current Permission Summary */}
      {permissionSummary && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">📊 Current Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Total Features</div>
              <div className="text-lg">{permissionSummary.totalFeatures}</div>
            </div>
            <div>
              <div className="font-medium text-green-600">Enabled</div>
              <div className="text-lg text-green-600">{permissionSummary.enabledCount}</div>
            </div>
            <div>
              <div className="font-medium text-yellow-600">Partial</div>
              <div className="text-lg text-yellow-600">{permissionSummary.partialCount}</div>
            </div>
            <div>
              <div className="font-medium text-gray-600">Available</div>
              <div className="text-lg text-gray-600">{permissionSummary.missingCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">🎯 Select Features to Enable</h3>
        <div className="space-y-3">
          {featureItems.map((item) => (
            <div
              key={item.key}
              className={`p-4 border rounded-lg ${
                item.enabled ? 'bg-green-50 border-green-200' :
                item.partial ? 'bg-yellow-50 border-yellow-200' :
                'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedFeatures.includes(item.key)}
                      onChange={() => handleFeatureToggle(item.key)}
                      disabled={item.required || loading}
                      className="h-4 w-4"
                    />
                    <h4 className="font-medium">{item.name}</h4>
                    {item.required && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        Required
                      </span>
                    )}
                    {item.enabled && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        ✅ Enabled
                      </span>
                    )}
                    {item.partial && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                        ⚠️ Partial
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      View required permissions ({item.permissions.length})
                    </summary>
                    <ul className="mt-1 ml-4 list-disc list-inside text-gray-500">
                      {item.permissions.map((perm) => (
                        <li key={perm}>{perm}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleUpdatePermissions}
          disabled={loading || !accessToken}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Updating...' : '🔄 Update Permissions'}
        </button>
        
        <button
          onClick={() => loadCurrentPermissions(M365_ASSESSMENT_CONFIG.clientId, accessToken)}
          disabled={loading || !accessToken}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Loading...' : '🔍 Refresh Status'}
        </button>
      </div>

      {/* Developer Info */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
        <h4 className="font-semibold mb-2">🔧 Developer Information</h4>
        <p><strong>Client ID:</strong> {M365_ASSESSMENT_CONFIG.clientId}</p>
        <p><strong>Selected Features:</strong> {selectedFeatures.join(', ')}</p>
        <p><strong>Current Permissions:</strong> {featureAnalysis?.currentPermissions.length || 0}</p>
      </div>
    </div>
  );
};

export default PermissionManager;
