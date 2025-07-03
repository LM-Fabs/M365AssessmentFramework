// API Warmup Service to reduce cold start times
export class ApiWarmupService {
  private static instance: ApiWarmupService;
  private baseUrl: string;
  private warmupStarted: boolean = false;
  private warmupCompleted: boolean = false;

  private constructor() {
    if (process.env.NODE_ENV === 'development') {
      this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:7072/api';
    } else {
      this.baseUrl = '/api';
    }
  }

  public static getInstance(): ApiWarmupService {
    if (!ApiWarmupService.instance) {
      ApiWarmupService.instance = new ApiWarmupService();
    }
    return ApiWarmupService.instance;
  }

  public async warmupApi(): Promise<void> {
    if (this.warmupStarted) {
      return;
    }

    this.warmupStarted = true;
    console.log('🔥 Starting API warmup...');

    try {
      // Multiple warmup strategies
      await Promise.allSettled([
        this.pingTestEndpoint(),
        this.pingDiagnosticsEndpoint(),
        this.preloadCustomers()
      ]);

      this.warmupCompleted = true;
      console.log('✅ API warmup completed');
    } catch (error) {
      console.warn('⚠️ API warmup failed, but continuing:', error);
    }
  }

  private async pingTestEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/test`, {
        method: 'HEAD', // Use HEAD to minimize data transfer
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      console.log('✅ Test endpoint warmed up:', response.status);
    } catch (error) {
      console.warn('⚠️ Test endpoint warmup failed:', error);
    }
  }

  private async pingDiagnosticsEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/diagnostics`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      console.log('✅ Diagnostics endpoint warmed up:', response.status);
    } catch (error) {
      console.warn('⚠️ Diagnostics endpoint warmup failed:', error);
    }
  }

  private async preloadCustomers(): Promise<void> {
    try {
      // Import CustomerService dynamically to avoid circular dependencies
      const { CustomerService } = await import('./customerService');
      const customerService = CustomerService.getInstance();
      
      // Start prefetching customers data
      console.log('🚀 ApiWarmupService: Starting customer prefetch...');
      await customerService.prefetchCustomers();
      
    } catch (error) {
      console.warn('⚠️ Customer prefetch failed:', error);
    }
  }

  public isWarmupCompleted(): boolean {
    return this.warmupCompleted;
  }

  // Background warmup with retries
  public startBackgroundWarmup(): void {
    // Start immediately
    this.warmupApi();

    // Also set up periodic warmup every 10 minutes to keep functions warm
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.pingTestEndpoint();
      }
    }, 10 * 60 * 1000); // 10 minutes
  }
}
