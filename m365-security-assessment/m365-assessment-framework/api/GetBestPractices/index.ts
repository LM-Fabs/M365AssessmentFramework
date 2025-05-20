import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { getBestPractices } from "../shared/constants";

const httpTrigger: AzureFunction = async (context: Context, req: HttpRequest): Promise<void> => {
    context.log('GetBestPractices function processed a request.');

    try {
        const bestPractices = await getBestPractices();
        context.res = {
            status: 200,
            body: bestPractices
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: "Error retrieving best practices."
        };
    }
};

export default httpTrigger;