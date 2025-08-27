
class CustomError extends Error {
    constructor({ success = false, message = '', data = {}, statusCode = 400}) {
        super(message);
        this.name = 'CustomError';
        this.success = success;
        this.message = message;
        this.data = data;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: this.success,
            message: this.message,
            data: this.data,
            statusCode: this.statusCode,
        };
    }
}

export default CustomError;
