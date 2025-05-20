import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getAssessmentData } from "../shared/database"; // Assuming a function to fetch data from a database

const httpTrigger: AzureFunction = async (context: Context, req: HttpRequest): Promise<void> => {
    const tenantId = req.query.tenantId;

    if (!tenantId) {
        context.res = {
            status: 400,
            body: "Please provide a tenantId in the query string."
        };
        return;
    }

    try {
        const assessmentData = await getAssessmentData(tenantId);
        
        if (!assessmentData) {
            context.res = {
                status: 404,
                body: "Assessment data not found for the provided tenantId."
            };
            return;
        }

        context.res = {
            status: 200,
            body: assessmentData
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: "An error occurred while retrieving assessment data."
        };
    }
};

export default httpTrigger;