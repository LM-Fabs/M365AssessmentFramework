/**
 * Example integration for fetching secure score control profiles
 * This demonstrates how to enhance the secureScoreFormatter with real Microsoft Graph API data
 */

interface SecureScoreControlProfile {
  id: string;
  title: string;
  remediation: string;
  service: string;
  controlCategory: string;
  actionType: string;
  deprecated: boolean;
  maxScore: number;
  rank: number;
  userImpact: string;
  implementationCost: string;
}

interface ControlProfileCache {
  profiles: Map<string, SecureScoreControlProfile>;
  lastUpdated: Date;
  expiryHours: number;
}

class SecureScoreControlService {
  private cache: ControlProfileCache = {
    profiles: new Map(),
    lastUpdated: new Date(0), // Start with very old date
    expiryHours: 24 // Cache for 24 hours
  };

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - this.cache.lastUpdated.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate < this.cache.expiryHours;
  }

  /**
   * Fetch control profiles from Microsoft Graph API
   * This would be integrated with your existing Graph API client
   */
  private async fetchControlProfiles(): Promise<SecureScoreControlProfile[]> {
    try {
      // Example API call - replace with your actual Graph API implementation
      const response = await fetch('/api/security/secureScoreControlProfiles', {
        headers: {
          'Authorization': 'Bearer ' + await this.getAccessToken(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.warn('Failed to fetch control profiles from API:', error);
      return [];
    }
  }

  /**
   * Get access token - implement based on your authentication strategy
   */
  private async getAccessToken(): Promise<string> {
    // For now, return empty string to trigger graceful fallback
    // TODO: Integrate with existing MSAL or authentication system
    console.warn('SecureScoreControlService: Authentication not yet integrated, falling back to static mapping');
    throw new Error('Authentication not yet integrated');
  }

  /**
   * Get control profiles with caching
   */
  async getControlProfiles(): Promise<Map<string, SecureScoreControlProfile>> {
    // Return cached data if still valid
    if (this.isCacheValid() && this.cache.profiles.size > 0) {
      return this.cache.profiles;
    }

    try {
      // Fetch fresh data from API
      const profiles = await this.fetchControlProfiles();
      
      // Update cache
      this.cache.profiles.clear();
      profiles.forEach(profile => {
        this.cache.profiles.set(profile.id, profile);
      });
      this.cache.lastUpdated = new Date();

      console.log(`Loaded ${profiles.length} control profiles from Microsoft Graph API`);
      return this.cache.profiles;
    } catch (error) {
      console.error('Failed to update control profiles cache:', error);
      
      // Return existing cache even if expired, better than nothing
      return this.cache.profiles;
    }
  }

  /**
   * Get a specific control profile by ID
   */
  async getControlProfile(controlId: string): Promise<SecureScoreControlProfile | null> {
    const profiles = await this.getControlProfiles();
    return profiles.get(controlId) || null;
  }

  /**
   * Enhanced control name resolution using API data
   */
  async getEnhancedControlName(controlName: string, fallbackDescription?: string): Promise<string> {
    try {
      const profile = await this.getControlProfile(controlName);
      
      if (profile) {
        // Use the official title from Microsoft Graph API
        if (profile.title && profile.title.length > 3 && !profile.deprecated) {
          return profile.title;
        }

        // Fall back to remediation if title is not good
        if (profile.remediation && profile.remediation.length > 10) {
          return this.cleanDescription(profile.remediation);
        }
      }

      // If API data is not available, fall back to existing logic
      return this.getReadableControlNameFallback(controlName, fallbackDescription);
    } catch (error) {
      console.warn('Failed to get enhanced control name:', error);
      return this.getReadableControlNameFallback(controlName, fallbackDescription);
    }
  }

  /**
   * Clean up description text
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/^Microsoft\s+/i, '')
      .replace(/\s+\(.*?\)$/, '')
      .replace(/\.$/, '')
      .trim()
      .substring(0, 100); // Limit length for UI display
  }

  /**
   * Fallback to existing static mapping logic
   */
  private getReadableControlNameFallback(controlName: string, description?: string): string {
    // Import and use the existing getReadableControlName function
    // This maintains backward compatibility
    const { getReadableControlName } = require('./secureScoreFormatter');
    return getReadableControlName(controlName, description);
  }

  /**
   * Preload control profiles in background (can be called on app startup)
   */
  async preloadControlProfiles(): Promise<void> {
    try {
      await this.getControlProfiles();
    } catch (error) {
      console.warn('Failed to preload control profiles:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; lastUpdated: Date; isValid: boolean } {
    return {
      size: this.cache.profiles.size,
      lastUpdated: this.cache.lastUpdated,
      isValid: this.isCacheValid()
    };
  }
}

// Export singleton instance
export const secureScoreControlService = new SecureScoreControlService();

// Example usage in your secure score processing code:
/*
async function processSecureScoreData(secureScoreData: any[]) {
  for (const control of secureScoreData) {
    // Enhanced control name resolution
    const displayName = await secureScoreControlService.getEnhancedControlName(
      control.controlName,
      control.description
    );
    
    console.log(`Control: ${control.controlName} -> ${displayName}`);
  }
}

// Preload on application startup
secureScoreControlService.preloadControlProfiles();
*/

export default SecureScoreControlService;
