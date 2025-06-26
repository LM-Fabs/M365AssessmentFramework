import { Assessment } from '../models/Assessment';

interface AssessmentHistory {
  assessmentId: string;
  tenantId: string;
  date: Date;
  overallScore: number;
  categoryScores: {
    identity: number;
    dataProtection: number;
    endpoint: number;
    cloudApps: number;
  };
  metrics: any;
}

interface ScoreComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

interface AssessmentComparison {
  overall: ScoreComparison;
  categories: {
    identity: ScoreComparison;
    dataProtection: ScoreComparison;
    endpoint: ScoreComparison;
    cloudApps: ScoreComparison;
  };
  timespan: {
    current: Date;
    previous: Date;
    daysDifference: number;
  };
}

export class AssessmentHistoryService {
  private static instance: AssessmentHistoryService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || '/api';
  }

  public static getInstance(): AssessmentHistoryService {
    if (!AssessmentHistoryService.instance) {
      AssessmentHistoryService.instance = new AssessmentHistoryService();
    }
    return AssessmentHistoryService.instance;
  }

  /**
   * Store assessment history when a new assessment is completed
   */
  public async storeAssessmentHistory(assessment: Assessment): Promise<void> {
    try {
      const historyEntry: AssessmentHistory = {
        assessmentId: assessment.id,
        tenantId: assessment.tenantId,
        date: assessment.assessmentDate,
        overallScore: assessment.metrics.score?.overall || 0,
        categoryScores: {
          identity: assessment.metrics.score?.identity || 0,
          dataProtection: assessment.metrics.score?.dataProtection || 0,
          endpoint: assessment.metrics.score?.endpoint || 0,
          cloudApps: assessment.metrics.score?.cloudApps || 0
        },
        metrics: assessment.metrics
      };

      const response = await fetch(`${this.baseUrl}/assessment-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(historyEntry)
      });

      if (!response.ok) {
        throw new Error(`Failed to store assessment history: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error storing assessment history:', error);
      throw error;
    }
  }

  /**
   * Get assessment history for a tenant
   */
  public async getAssessmentHistory(tenantId: string, limit: number = 10): Promise<AssessmentHistory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/assessment-history/${tenantId}?limit=${limit}`, {
        signal: AbortSignal.timeout(15000) // 15 second timeout (increased from 3)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('ℹ️ AssessmentHistory: No history found for tenant:', tenantId);
          return []; // No history found
        }
        throw new Error(`Failed to fetch assessment history: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 AssessmentHistory: Raw response for tenant', tenantId, ':', data);
      
      // Ensure we always return an array - handle various response formats
      let historyArray: any[] = [];
      
      if (Array.isArray(data)) {
        historyArray = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) {
          historyArray = data.data;
        } else if (data.success && Array.isArray(data.data)) {
          historyArray = data.data;
        } else {
          console.warn('⚠️ AssessmentHistory: Unexpected response format:', data);
          return [];
        }
      }
      
      console.log('✅ AssessmentHistory: Processed array with', historyArray.length, 'items');
      
      return historyArray.map((item: any) => ({
        ...item,
        date: new Date(item.date)
      }));
    } catch (error: any) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        console.warn('⏱️ AssessmentHistory: Request timed out after 15 seconds for tenant:', tenantId);
        return [];
      }
      console.error('Error fetching assessment history for tenant', tenantId, ':', error);
      return []; // Return empty array on error to prevent UI crashes
    }
  }

  /**
   * Compare current assessment with the most recent previous assessment
   */
  public async compareWithPrevious(currentAssessment: Assessment): Promise<AssessmentComparison | null> {
    try {
      const history = await this.getAssessmentHistory(currentAssessment.tenantId, 2);
      
      // Filter out the current assessment and get the most recent previous one
      const previousAssessments = history
        .filter(h => h.assessmentId !== currentAssessment.id)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      if (previousAssessments.length === 0) {
        return null; // No previous assessment to compare with
      }

      const previous = previousAssessments[0];
      const current = {
        date: currentAssessment.assessmentDate,
        overallScore: currentAssessment.metrics.score?.overall || 0,
        categoryScores: {
          identity: currentAssessment.metrics.score?.identity || 0,
          dataProtection: currentAssessment.metrics.score?.dataProtection || 0,
          endpoint: currentAssessment.metrics.score?.endpoint || 0,
          cloudApps: currentAssessment.metrics.score?.cloudApps || 0
        }
      };

      const calculateComparison = (currentScore: number, previousScore: number): ScoreComparison => {
        const change = currentScore - previousScore;
        const changePercent = previousScore === 0 ? 0 : Math.round((change / previousScore) * 100);
        
        return {
          current: currentScore,
          previous: previousScore,
          change: Math.round(change * 100) / 100,
          changePercent
        };
      };

      const comparison: AssessmentComparison = {
        overall: calculateComparison(current.overallScore, previous.overallScore),
        categories: {
          identity: calculateComparison(current.categoryScores.identity, previous.categoryScores.identity),
          dataProtection: calculateComparison(current.categoryScores.dataProtection, previous.categoryScores.dataProtection),
          endpoint: calculateComparison(current.categoryScores.endpoint, previous.categoryScores.endpoint),
          cloudApps: calculateComparison(current.categoryScores.cloudApps, previous.categoryScores.cloudApps)
        },
        timespan: {
          current: current.date,
          previous: previous.date,
          daysDifference: Math.floor((current.date.getTime() - previous.date.getTime()) / (1000 * 60 * 60 * 24))
        }
      };

      return comparison;
    } catch (error) {
      console.error('Error comparing assessments:', error);
      return null;
    }
  }

  /**
   * Get recent assessments for dashboard display
   */
  public async getRecentAssessments(tenantId: string, limit: number = 5): Promise<AssessmentHistory[]> {
    console.log('🔍 Getting recent assessments for tenant:', tenantId);
    
    if (!tenantId) {
      console.warn('⚠️ No tenantId provided to getRecentAssessments');
      return [];
    }
    
    try {
      return await this.getAssessmentHistory(tenantId, limit);
    } catch (error) {
      console.error('Error in getRecentAssessments:', error);
      return [];
    }
  }

  /**
   * Get assessments for a specific customer
   */
  public async getCustomerAssessments(customerId: string, limit: number = 5): Promise<AssessmentHistory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/assessment-history/customer/${customerId}?limit=${limit}`, {
        signal: AbortSignal.timeout(15000) // 15 second timeout (increased from 3)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('ℹ️ AssessmentHistory: No history found for customer:', customerId);
          return []; // No history found
        }
        throw new Error(`Failed to fetch customer assessment history: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 AssessmentHistory: Raw response for customer', customerId, ':', data);
      
      // Ensure we always return an array - handle various response formats
      let historyArray: any[] = [];
      
      if (Array.isArray(data)) {
        historyArray = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) {
          historyArray = data.data;
        } else if (data.success && Array.isArray(data.data)) {
          historyArray = data.data;
        } else {
          console.warn('⚠️ AssessmentHistory: Unexpected response format:', data);
          return [];
        }
      }
      
      console.log('✅ AssessmentHistory: Processed array with', historyArray.length, 'items');
      
      return historyArray.map((item: any) => ({
        ...item,
        date: new Date(item.date)
      }));
    } catch (error: any) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        console.warn('⏱️ AssessmentHistory: Request timed out after 15 seconds for customer:', customerId);
        return [];
      }
      console.error('Error fetching customer assessment history for', customerId, ':', error);
      return []; // Return empty array on error to prevent UI crashes
    }
  }

  /**
   * Delete old assessment history (for cleanup)
   */
  public async cleanupOldHistory(tenantId: string, keepDays: number = 90): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/assessment-history/${tenantId}/cleanup`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keepDays })
      });
    } catch (error) {
      console.error('Error cleaning up old assessment history:', error);
      // Don't throw, as this is a background operation
    }
  }
}