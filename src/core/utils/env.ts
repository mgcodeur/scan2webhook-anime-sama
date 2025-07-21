import dotenv from 'dotenv';

dotenv.config();

export const env = (key: string, defaultValue?: string): string => {
    const value = process.env[key];
    
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Missing environment variable: ${key}`);
    }
    
    return value;
}