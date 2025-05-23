import { Assessment } from '../../models/Assessment';

export interface GetAssessmentResponse {
    assessment: Assessment;
    status: string;
    message: string;
}