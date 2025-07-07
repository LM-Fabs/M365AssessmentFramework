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
    console.log('🔥 Starting ultra-fast API warmup...');

    try {
      // Ultra-fast parallel warmup with minimal timeout
      const warmupPromises = [
        this.pingTestEndpoint(),
        this.pingDiagnosticsEndpoint(),
        this.pingCurrentAssessmentEndpoint(),
        this.pingBestPracticesEndpoint()
      ];

      // Ultra-fast parallel execution with 1.5-second timeout
      await Promise.allSettled(warmupPromises.map(p => 
        Promise.race([
          p,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Warmup timeout')), 1500)
          )
        ])
      ));

      // Start customer preload in background (don't wait for it)
      this.preloadCustomers().catch(error => 
        console.warn('⚠️ Background customer prefetch failed:', error)
      );

      this.warmupCompleted = true;
      console.log('✅ API warmup completed in <1.5s');
    } catch (error) {
      console.warn('⚠️ API warmup failed, but continuing:', error);
      this.warmupCompleted = true; // Continue even if warmup fails
    }
  }

  private async pingTestEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/test`, {
        method: 'HEAD', // Use HEAD to minimize data transfer
        signal: AbortSignal.timeout(1000) // Ultra-fast 1 second timeout
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
        signal: AbortSignal.timeout(1000) // Ultra-fast 1 second timeout
      });
      console.log('✅ Diagnostics endpoint warmed up:', response.status);
    } catch (error) {
      console.warn('⚠️ Diagnostics endpoint warmup failed:', error);
    }
  }

  private async pingCurrentAssessmentEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/assessment/current`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000) // Ultra-fast 1 second timeout
      });
      console.log('✅ Current assessment endpoint warmed up:', response.status);
    } catch (error) {
      console.warn('⚠️ Current assessment endpoint warmup failed:', error);
    }
  }

  private async pingBestPracticesEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/best-practices`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000) // Ultra-fast 1 second timeout
      });
      console.log('✅ Best practices endpoint warmed up:', response.status);
    } catch (error) {
      console.warn('⚠️ Best practices endpoint warmup failed:', error);
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

    // Also set up more aggressive periodic warmup every 5 minutes to keep functions warm
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        // Ping critical endpoints to keep them warm
        Promise.all([
          this.pingTestEndpoint(),
          this.pingCurrentAssessmentEndpoint()
        ]).catch(error => 
          console.warn('⚠️ Background warmup ping failed:', error)
        );
      }
    }, 5 * 60 * 1000); // 5 minutes instead of 10

    // Also warmup on page focus to ensure immediate responsiveness
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.warmupCompleted) {
        this.pingTestEndpoint().catch(() => {}); // Silent fail
      }
    });
  }
}
