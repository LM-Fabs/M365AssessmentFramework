import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { Assessment } from "../shared/types";
import { saveAssessmentToDatabase } from "../shared/database";

const httpTrigger: AzureFunction = async (context: Context, req: HttpRequest): Promise<void> => {
    const assessment: Assessment = req.body;

    if (!assessment) {
        context.res = {
            status: 400,
            body: "Please provide a valid assessment."
        };
        return;
    }

    try {
        await saveAssessmentToDatabase(assessment);
        context.res = {
            status: 201,
            body: { message: "Assessment saved successfully." }
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: { message: "Error saving assessment.", error: error.message }
        };
    }
};

export default httpTrigger;