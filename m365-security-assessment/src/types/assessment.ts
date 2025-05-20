export interface Assessment {
    id: string;
    date: Date;
    score: number;
    metrics: Record<string, any>; // You can specify a more detailed type based on your metrics structure
}