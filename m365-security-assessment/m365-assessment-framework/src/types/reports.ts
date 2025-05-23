export interface Report {
    reportId: string;
    assessmentId: string;
    dateGenerated: Date;
    findings: string[];
}