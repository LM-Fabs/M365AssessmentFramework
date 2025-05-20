export const saveAssessment = async (assessment) => {
    try {
        const response = await fetch('/api/SaveAssessment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(assessment),
        });
        return await response.json();
    } catch (error) {
        console.error('Error saving assessment:', error);
        throw error;
    }
};

export const getAssessments = async () => {
    try {
        const response = await fetch('/api/GetAssessment');
        return await response.json();
    } catch (error) {
        console.error('Error fetching assessments:', error);
        throw error;
    }
};

export const getBestPractices = async () => {
    try {
        const response = await fetch('/api/GetBestPractices');
        return await response.json();
    } catch (error) {
        console.error('Error fetching best practices:', error);
        throw error;
    }
};